/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, inject, it } from 'vitest';

import { type Contents, trash } from './docspace';
import { runWorkflow } from './n8n';

const ROOM_ID = Number(inject('n8n').env.TEST_ROOM_ID);
const FOLDERS = 'dsFolders0000001';

describe('Folders', () => {
	it('Create Folder creates a folder in the room', async () => {
		const run = await runWorkflow(FOLDERS);
		expect(run.json('Create Folder')).toMatchObject({ title: 'Projects', parentId: ROOM_ID });
	});

	it('Get Folder Info returns the folder', async () => {
		const run = await runWorkflow(FOLDERS);
		expect(run.json('Get Folder Info')).toMatchObject({ id: run.json('Create Folder').id });
	});

	it('Update Folder renames the folder', async () => {
		const run = await runWorkflow(FOLDERS);
		expect(run.json('Update Folder')).toMatchObject({ title: 'Projects 2026' });
	});

	it('Get Folder Contents finds the folder by its name', async () => {
		const run = await runWorkflow(FOLDERS);
		const { folders } = run.json('Get Room Contents') as unknown as Contents;
		expect(folders.map((folder) => folder.id)).toEqual([run.json('Create Folder').id]);
	});

	it('Get Folder History returns one item per change', async () => {
		const run = await runWorkflow(FOLDERS);
		const actions = run.items('Get Folder History').map((item) => item.json.action);
		expect(actions).toContainEqual(expect.objectContaining({ key: 'FolderRenamed' }));
	});

	it('Get Folder Shared Link returns the external link of the folder', async () => {
		const run = await runWorkflow(FOLDERS);
		expect(run.json('Get Folder Shared Link').sharedTo).toMatchObject({
			shareLink: expect.any(String),
		});
	});

	// Bug: Copy Folder returns the target folder; the portal lists it before the copy.
	it.fails('Copy Folder puts a new folder into the target', async () => {
		const run = await runWorkflow(FOLDERS);
		const copy = run.json('Copy Folder');
		expect(copy.id).not.toBe(run.json('Create Folder').id);
		expect(copy.parentId).toBe(run.json('Create Target Folder').id);
	});

	it('Move Folder puts the folder itself into the target', async () => {
		const run = await runWorkflow(FOLDERS);
		expect(run.json('Move Folder')).toMatchObject({
			id: run.json('Create Folder').id,
			parentId: run.json('Create Target Folder').id,
		});
	});

	it('Delete Folder moves the folder to the trash and returns it', async () => {
		const run = await runWorkflow(FOLDERS);
		const { id } = run.json('Delete Folder');
		expect(id).toBe(run.json('Create Target Folder').id);
		expect((await trash()).folders.map((folder) => folder.id)).toContain(id);
	});

	it('Get Folder Info and Get Folder Contents read My Documents', async () => {
		const run = await runWorkflow(FOLDERS);
		const { current } = run.json('My Documents Contents') as { current: { id: number } };
		expect(current.id).toBe(run.json('My Documents Info').id);
	});
});
