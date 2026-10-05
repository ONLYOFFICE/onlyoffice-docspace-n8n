/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IDataObject, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { OnlyofficeDocspaceTrigger } from '../../nodes/OnlyofficeDocspace/OnlyofficeDocspaceTrigger.node';
import { calls, runHook, runWebhook, WEBHOOK_URL } from './helpers';
import {
	FILE_CREATED,
	ROOM_CREATED,
	SECRET_KEY,
	signature,
	USER_INVITED,
} from './webhook-payloads';

const PARAMS = { name: 'n8n', secretKey: SECRET_KEY, ssl: true };
const WEBHOOKS = 'api/2.0/settings/webhook';
const { description } = new OnlyofficeDocspaceTrigger();

// ---- Registration: n8n calls checkExists and create on activation, delete on deactivation ----

describe('checkExists', () => {
	const checkExists = (staticData: IDataObject) =>
		runHook('checkExists', {
			params: PARAMS,
			routes: { [`GET ${WEBHOOKS}`]: [{ configs: { id: 41 } }, { configs: { id: 42 } }] },
			staticData,
		});

	it.each([
		[{ webhookId: 42 }, true],
		[{ webhookId: 43 }, false],
		[{}, false],
	])('finds the kept webhook %j on the portal: %s', async (staticData, exists) => {
		expect((await checkExists(staticData)).result).toBe(exists);
	});
});

describe('create', () => {
	const create = (events: number[], staticData: IDataObject = {}) =>
		runHook('create', {
			params: { ...PARAMS, events },
			routes: { [`POST ${WEBHOOKS}`]: { id: 42 } },
			staticData,
		});

	it('registers the webhook URL for the sum of the events and keeps its ID', async () => {
		const staticData: IDataObject = {};
		const { result, requests } = await create([128, 256], staticData);
		expect(requests[0].body).toEqual({
			name: 'n8n',
			uri: WEBHOOK_URL,
			secretKey: SECRET_KEY,
			enabled: true,
			ssl: true,
			triggers: 384,
		});
		expect([result, staticData]).toEqual([true, { webhookId: 42 }]);
	});

	it('sends 0 (all events) when All Events is selected', async () => {
		const { requests } = await create([128, 0, 256]);
		expect(requests[0].body).toMatchObject({ triggers: 0 });
	});

	it('fails without events before it calls the portal', async () => {
		await expect(create([])).rejects.toThrow('No events selected');
	});
});

describe('delete', () => {
	it('removes the webhook from the portal and forgets its ID', async () => {
		const staticData: IDataObject = { webhookId: 42 };
		const { result, requests } = await runHook('delete', {
			params: PARAMS,
			routes: { [`DELETE ${WEBHOOKS}/42`]: {} },
			staticData,
		});
		expect(calls(requests)).toEqual([`DELETE ${WEBHOOKS}/42`]);
		expect([result, staticData]).toEqual([true, {}]);
	});

	it('does nothing without a kept ID', async () => {
		const { result, requests } = await runHook('delete', { params: PARAMS });
		expect([result, requests]).toEqual([true, []]);
	});
});

// ---- Incoming request: a delivery from the portal ----

describe('incoming request', () => {
	it.each([FILE_CREATED, ROOM_CREATED, USER_INVITED])(
		'starts the workflow with a $event.trigger delivery as one item, unchanged',
		async (body) => {
			const { result } = await runWebhook({ webhookName: 'default', body }, PARAMS);
			expect(result).toEqual({ workflowData: [[{ json: body }]] });
		},
	);

	it('accepts a delivery signed with the secret key', async () => {
		const headers = { 'x-docspace-signature-256': signature(FILE_CREATED) };
		const { result } = await runWebhook(
			{ webhookName: 'default', body: FILE_CREATED, headers },
			PARAMS,
		);
		expect(result).toEqual({ workflowData: [[{ json: FILE_CREATED }]] });
	});

	// Bug: the trigger does not check x-docspace-signature-256, so anyone who knows the URL can
	// start the workflow.
	it.fails('rejects a delivery with a wrong signature with 401', async () => {
		const headers = { 'x-docspace-signature-256': signature(FILE_CREATED, 'otherkey') };
		const { result, response } = await runWebhook(
			{ webhookName: 'default', body: FILE_CREATED, headers },
			PARAMS,
		);
		expect([result, response.statusCode]).toEqual([{ noWebhookResponse: true }, 401]);
	});
});

// ---- Response ----

describe('webhook response', () => {
	it('answers the HEAD check of the portal with 200 and starts no workflow', async () => {
		const { result, response } = await runWebhook({ webhookName: 'setup' });
		expect(result).toEqual({ noWebhookResponse: true });
		expect(response).toEqual({ statusCode: 200, ended: true });
	});

	it('leaves the answer to a delivery to n8n', async () => {
		const { response } = await runWebhook({ webhookName: 'default', body: FILE_CREATED }, PARAMS);
		expect(response).toEqual({ statusCode: 0, ended: false });
	});

	// The portal checks the URL with HEAD and posts events to the same URL.
	it('serves HEAD and POST on one path, answered when received', () => {
		expect(description.webhooks).toEqual([
			{ name: 'setup', httpMethod: 'HEAD', responseMode: 'onReceived', path: 'webhook' },
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
		]);
	});
});

describe('trigger description', () => {
	// The OAuth server does not issue tokens with webhook scopes yet.
	it('offers every authentication except OAuth2', () => {
		const authentication = description.properties.find((p) => p.name === 'authentication')!;
		expect(authentication.options!.map((o) => (o as INodePropertyOptions).value)).toEqual([
			'apiKey',
			'basicAuth',
			'personalAccessToken',
		]);
	});
});
