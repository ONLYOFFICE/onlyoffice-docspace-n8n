/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/require-node-api-error -- test code runs in Node/vitest, not in n8n */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { IDataObject } from 'n8n-workflow';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { docspace, type Entry, poll } from './docspace';
import { n8n, start } from './n8n';
import trigger from './workflows/dsTrigger0000001.json';

const environment = inject('n8n');
const { TEST_PREFIX, TEST_ROOM_ID } = environment.env;
const node = trigger.nodes.find((n) => 'webhookId' in n)!;

interface Webhook {
	configs: { name: string; uri: string; enabled: boolean; triggers: number };
}

/** Start `server` on a free local port and return the port. */
async function listen(server: Server) {
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	return (server.address() as AddressInfo).port;
}

/**
 * The portal accepts only public webhook URLs that answer its HEAD check, so n8n gets one from a
 * Cloudflare quick tunnel, like in the test containers of n8n itself. The workflow posts every
 * event it gets to a local collector.
 */
describe('Trigger', () => {
	const events: IDataObject[] = [];
	const collector = createServer((request, response) => {
		let body = '';
		request
			.on('data', (chunk) => (body += chunk))
			.on('end', () => {
				events.push(JSON.parse(body));
				response.end();
			});
	});
	let tunnel: ReturnType<typeof start> | undefined;
	let server: ReturnType<typeof start> | undefined;
	let webhookUrl: string;
	let webhook: Webhook['configs'];

	beforeAll(async () => {
		const collectorPort = await listen(collector);
		const free = createServer();
		const metricsPort = await listen(free);
		free.close();
		tunnel = start(
			'cloudflared',
			[
				'tunnel',
				'--url',
				`http://localhost:${environment.env.N8N_PORT}`,
				'--metrics',
				`127.0.0.1:${metricsPort}`,
				'--no-autoupdate',
			],
			environment,
		);
		// The metrics server of cloudflared reports the public host name once the tunnel is up.
		const hostname = await poll(
			async () => {
				try {
					const response = await fetch(`http://127.0.0.1:${metricsPort}/quicktunnel`);
					return ((await response.json()) as { hostname?: string }).hostname || undefined;
				} catch {
					return undefined;
				}
			},
			60,
			'the tunnel',
		);
		webhookUrl = `https://${hostname}/`;
		await n8n(['publish:workflow', `--id=${trigger.id}`], environment);
		server = start('n8n', ['start'], {
			...environment,
			env: {
				...environment.env,
				N8N_WEBHOOK_URL: webhookUrl,
				// Requests come through one proxy, the tunnel.
				N8N_PROXY_HOPS: '1',
				COLLECTOR_URL: `http://127.0.0.1:${collectorPort}/`,
			},
		});
		// Activation of the workflow registers the webhook on the portal.
		try {
			webhook = await poll(
				async () => {
					const webhooks = await docspace<Webhook[]>('GET', 'api/2.0/settings/webhook');
					return webhooks.find((w) => w.configs.name === TEST_PREFIX)?.configs;
				},
				120,
				'the webhook on the portal',
			);
		} catch (error) {
			throw new Error(`${(error as Error).message}. n8n output:
${server.output()}`);
		}
	});

	afterAll(async () => {
		// Stopping n8n keeps the webhook on the portal; the global teardown deletes it by name.
		for (const child of [server, tunnel]) {
			child?.child.kill();
			await child?.exit;
		}
		collector.close();
	});

	it('activation registers a webhook for the selected events', () => {
		expect(webhook).toMatchObject({
			uri: `${webhookUrl}webhook/${node.webhookId}/webhook`,
			enabled: true,
			triggers: node.parameters.events!.reduce((sum, event) => sum + event, 0),
		});
	});

	it('a file created in DocSpace starts the workflow with the event', async () => {
		const file = await docspace<Entry>('POST', `api/2.0/files/${TEST_ROOM_ID}/file`, {
			title: 'Event.docx',
		});
		const event = await poll(
			async () => events.find((e) => (e.payload as Entry).id === file.id),
			120,
			'the event',
		);
		expect(event).toMatchObject({
			event: { trigger: 'file.created' },
			payload: { id: file.id, title: 'Event.docx' },
		});
	});
});
