/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals, @n8n/community-nodes/require-node-api-error -- test code runs in Node/vitest, not in n8n */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

import {
	type Contents,
	docspace,
	DOC_SPACE_BASE_URL,
	type Entry,
	finished,
	type Operation,
	trash,
} from './docspace';
import { n8n, type N8nEnvironment } from './n8n';

const ROOT = resolve(__dirname, '../..');

const trashed = async () => {
	const { files, folders } = await trash();
	return { fileIds: files.map((f) => f.id), folderIds: folders.map((f) => f.id) };
};

/**
 * Remove everything the run left on the portal: rooms, trashed items, webhooks, the API key.
 * Every step runs even if an earlier one fails, so one slow operation does not leave the key.
 */
async function cleanUp(
	prefix: string,
	trashBefore: Awaited<ReturnType<typeof trashed>>,
	keyId?: string,
) {
	const errors: string[] = [];
	const step = async (run: () => Promise<unknown>) => {
		try {
			await run();
		} catch (error) {
			errors.push((error as Error).message);
		}
	};
	await step(() => removeRooms(prefix));
	await step(() => emptyTrash(trashBefore));
	await step(() => removeWebhooks(prefix));
	if (keyId) await step(() => docspace('DELETE', `api/2.0/keys/${keyId}`));
	if (errors.length > 0) throw new Error(`Clean-up of the portal failed: ${errors.join('; ')}`);
}

async function removeRooms(prefix: string) {
	for (const searchArea of ['Active', 'Archive']) {
		const { folders } = await docspace<Contents>(
			'GET',
			`api/2.0/files/rooms?searchArea=${searchArea}&filterValue=${prefix}`,
		);
		for (const room of folders.filter((f) => f.title.startsWith(prefix))) {
			// Only archived rooms can be deleted.
			if (searchArea === 'Active') {
				await finished(
					await docspace<Operation>('PUT', `api/2.0/files/rooms/${room.id}/archive`, {
						deleteAfter: false,
					}),
				);
			}
			await finished(
				await docspace<Operation>('DELETE', `api/2.0/files/rooms/${room.id}`, {
					deleteAfter: false,
				}),
			);
		}
	}
}

// Deleted files and folders stay in the trash of the account, also after their room is gone.
async function emptyTrash(trashBefore: Awaited<ReturnType<typeof trashed>>) {
	const now = await trashed();
	const fileIds = now.fileIds.filter((id) => !trashBefore.fileIds.includes(id));
	const folderIds = now.folderIds.filter((id) => !trashBefore.folderIds.includes(id));
	if (fileIds.length + folderIds.length > 0) {
		await finished(
			await docspace<Operation[]>('PUT', 'api/2.0/files/fileops/delete', {
				fileIds,
				folderIds,
				immediately: true,
				deleteAfter: false,
			}),
		);
	}
}

async function removeWebhooks(prefix: string) {
	const webhooks = await docspace<Array<{ configs: { id: number; name: string } }>>(
		'GET',
		'api/2.0/settings/webhook',
	);
	for (const { configs } of webhooks.filter((w) => w.configs.name.startsWith(prefix))) {
		await docspace('DELETE', `api/2.0/settings/webhook/${configs.id}`);
	}
}

export default async function setup(project: TestProject) {
	const missing = ['DOC_SPACE_BASE_URL', 'DOC_SPACE_USERNAME', 'DOC_SPACE_PASSWORD'].filter(
		(name) => !process.env[name],
	);
	if (missing.length > 0) throw new Error(`Set ${missing.join(', ')} for the test portal`);

	const { docSpace } = await docspace<{ docSpace: string }>(
		'GET',
		'api/2.0/settings/version/build',
	);
	// Rooms and webhooks of the run carry the prefix, so the clean-up finds them.
	const prefix = `n8n-tests-${Date.now()}`;
	const trashBefore = await trashed();
	const home = mkdtempSync(join(tmpdir(), 'n8n-'));
	let keyId: string | undefined;

	try {
		// A temporary API key for the API Key credential. It expires by itself if the run crashes.
		const key = await docspace<{ id: string; key: string }>('POST', 'api/2.0/keys', {
			name: prefix,
			permissions: ['*'],
			expiresInDays: 1,
		});
		keyId = key.id;
		const room = await docspace<Entry>('POST', 'api/2.0/files/rooms', {
			title: prefix,
			roomType: 2,
		});

		const environment: N8nEnvironment = {
			home,
			env: {
				// vitest sets NODE_ENV=test, and the n8n CLI then exits without doing anything.
				NODE_ENV: 'production',
				N8N_USER_FOLDER: home,
				N8N_ENCRYPTION_KEY: 'tests',
				// `n8n execute` prints the run data only at the info level.
				N8N_LOG_LEVEL: 'info',
				N8N_DIAGNOSTICS_ENABLED: 'false',
				// The default port of n8n; the tunnel of the trigger test leads to it.
				N8N_PORT: '5678',
				// The workflows read the variables below.
				N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false',
				TEST_PREFIX: prefix,
				TEST_ROOM_ID: String(room.id),
			},
		};

		// Install the packed package like a manually installed community node.
		const nodes = join(home, '.n8n/nodes');
		mkdirSync(nodes, { recursive: true });
		const tarball = execFileSync('pnpm', ['pack', '--pack-destination', home], { cwd: ROOT })
			.toString()
			.trim()
			.split('\n')
			.pop()!;
		execFileSync('npm', ['install', '--prefix', nodes, join(home, basename(tarball))], {
			stdio: 'ignore',
		});

		const baseUrl = DOC_SPACE_BASE_URL;
		const credentials = join(home, 'credentials.json');
		writeFileSync(
			credentials,
			JSON.stringify([
				{
					id: 'dsBasicTestCred1',
					name: 'DocSpace Basic Auth (tests)',
					type: 'onlyofficeDocspaceBasicAuthApi',
					data: {
						baseUrl,
						email: process.env.DOC_SPACE_USERNAME,
						password: process.env.DOC_SPACE_PASSWORD,
					},
				},
				{
					id: 'dsApiKeyTestCrd1',
					name: 'DocSpace API Key (tests)',
					type: 'onlyofficeDocspaceApiKeyApi',
					data: { baseUrl, apiKey: key.key },
				},
				{
					id: 'dsBadKeyTestCrd1',
					name: 'DocSpace wrong API Key (tests)',
					type: 'onlyofficeDocspaceApiKeyApi',
					data: { baseUrl, apiKey: 'wrong' },
				},
			]),
		);
		await n8n(['import:credentials', `--input=${credentials}`], environment);
		await n8n(
			['import:workflow', '--separate', `--input=${join(ROOT, 'test/automation/workflows')}`],
			environment,
		);

		process.stdout.write(`DocSpace ${docSpace} at ${DOC_SPACE_BASE_URL}, test room ${prefix}\n`);
		project.provide('n8n', environment);
	} catch (error) {
		await cleanUp(prefix, trashBefore, keyId);
		rmSync(home, { recursive: true, force: true });
		throw error;
	}

	return async () => {
		await cleanUp(prefix, trashBefore, keyId);
		rmSync(home, { recursive: true, force: true });
	};
}
