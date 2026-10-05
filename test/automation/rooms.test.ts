/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, inject, it } from 'vitest';

import { type Contents, docspace } from './docspace';
import { runWorkflow } from './n8n';

const PREFIX = inject('n8n').env.TEST_PREFIX;
const ROOMS = 'dsRooms000000001';

describe('Rooms', () => {
	it('Create Room creates a room of the chosen type', async () => {
		const run = await runWorkflow(ROOMS);
		expect(run.json('Create Room')).toMatchObject({ title: `${PREFIX} public`, roomType: 6 });
	});

	it('Get Room Info returns the room', async () => {
		const run = await runWorkflow(ROOMS);
		expect(run.json('Get Room Info')).toMatchObject({ id: run.json('Create Room').id });
	});

	it('Update Room renames the room', async () => {
		const run = await runWorkflow(ROOMS);
		expect(run.json('Update Room')).toMatchObject({ title: `${PREFIX} renamed` });
	});

	it('Get Room Shared Link returns the external link of a public room', async () => {
		const run = await runWorkflow(ROOMS);
		expect(run.json('Get Room Shared Link').sharedTo).toMatchObject({
			shareLink: expect.any(String),
		});
	});

	it('Search Room finds the room by its name', async () => {
		const run = await runWorkflow(ROOMS);
		const { folders } = run.json('Search Room') as unknown as Contents;
		expect(folders.map((room) => room.id)).toEqual([run.json('Create Room').id]);
	});

	it('Search User lists the members of the room', async () => {
		const run = await runWorkflow(ROOMS);
		const members = run.items('Search Room Users').map((item) => item.json.sharedTo);
		expect(members).toEqual([expect.objectContaining({ isOwner: true })]);
	});

	it('Archive Room moves the room to the archive', async () => {
		const run = await runWorkflow(ROOMS);
		const { id } = run.json('Archive Room');
		const archive = await docspace<Contents>(
			'GET',
			`api/2.0/files/rooms?searchArea=Archive&filterValue=${PREFIX}`,
		);
		expect(archive.folders.map((room) => room.id)).toContain(id);
	});
});
