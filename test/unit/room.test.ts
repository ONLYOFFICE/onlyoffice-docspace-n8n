/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { calls, finished, request, type Routes, runNode } from './helpers';

const room = (params: IDataObject, routes: Routes) =>
	runNode({ params: { resource: 'room', roomId: { mode: 'list', value: 7 }, ...params }, routes });

const INFO = { id: 7, title: 'Team' };
const SHARE = 'PUT api/2.0/files/rooms/7/share';
const MEMBER = { access: 11, sharedTo: { id: 'u1', email: 'a@example.com' } };
const BY_EMAIL = { count: 1, filterBy: 'email', filterOp: 'equals', filterValue: 'a@example.com' };

describe('room requests', () => {
	it.each([
		[
			'createRoom',
			{ title: 'Team', roomType: 2 },
			'POST api/2.0/files/rooms',
			undefined,
			{ title: 'Team', roomType: 2 },
		],
		['getRoomInfo', {}, 'GET api/2.0/files/rooms/7', undefined, undefined],
		['getRoomSharedLink', {}, 'GET api/2.0/files/rooms/7/link', undefined, undefined],
		['updateRoom', { title: 'New' }, 'PUT api/2.0/files/rooms/7', undefined, { title: 'New' }],
		['searchRoom', { query: 'Te' }, 'GET api/2.0/files/rooms', { filterValue: 'Te' }, undefined],
		[
			'searchUser',
			{ query: 'Al' },
			'GET api/2.0/files/rooms/7/share',
			{ filterValue: 'Al' },
			undefined,
		],
	])('%s %j sends %s', async (operation, params, call, qs, body) => {
		const { output, requests } = await room({ operation, ...params }, { [call]: INFO });
		expect(calls(requests)).toEqual([call]);
		expect([requests[0].qs, requests[0].body]).toEqual([qs, body]);
		expect(output[0].json).toEqual(INFO);
	});

	it('Archive Room returns the room as it was before archiving', async () => {
		const { output, requests } = await room(
			{ operation: 'archiveRoom' },
			{ 'GET api/2.0/files/rooms/7': INFO, 'PUT api/2.0/files/rooms/7/archive': finished() },
		);
		expect(requests[1].body).toEqual({ deleteAfter: false });
		expect(output[0].json).toEqual(INFO);
	});
});

// ---- Room members ----

describe('Invite User and Update User', () => {
	it.each(['inviteUser', 'updateUser'])('%s by ID returns the member', async (operation) => {
		const { output, requests } = await room(
			{
				operation,
				userId: { mode: 'list', value: 'u1' },
				userAccess: { mode: 'list', value: 11 },
				notify: false,
			},
			{ [SHARE]: { members: [MEMBER] } },
		);
		expect(requests[0].body).toMatchObject({ invitations: [{ id: 'u1', access: 11 }] });
		expect(output[0].json).toEqual(MEMBER);
	});

	it.each(['inviteUser', 'updateUser'])('%s by email looks the member up', async (operation) => {
		const { output, requests } = await room(
			{ operation, userEmail: 'a@example.com', userAccess: 11, notify: false },
			{ [SHARE]: { members: [] }, 'GET api/2.0/files/rooms/7/share': [MEMBER] },
		);
		expect(requests[0].body).toMatchObject({
			invitations: [{ email: 'a@example.com', access: 11 }],
		});
		expect(requests[1].qs).toEqual(BY_EMAIL);
		expect(output[0].json).toEqual(MEMBER);
	});

	it('Invite User sends the notification in the chosen language', async () => {
		const { requests } = await room(
			{ operation: 'inviteUser', userId: 'u1', userAccess: 2, notify: true, culture: 'de' },
			{ [SHARE]: { members: [MEMBER] } },
		);
		expect(requests[0].body).toEqual({
			invitations: [{ id: 'u1', access: 2 }],
			notify: true,
			culture: 'de',
		});
	});
});

describe('Remove User', () => {
	it('by ID finds the email of the user, then sets no access', async () => {
		const { output, requests } = await room(
			{ operation: 'removeUser', userId: 'u1' },
			{
				'GET api/2.0/people/u1': { email: 'a@example.com' },
				'GET api/2.0/files/rooms/7/share': [MEMBER],
				[SHARE]: { members: [] },
			},
		);
		expect(calls(requests)).toEqual([
			'GET api/2.0/people/u1',
			'GET api/2.0/files/rooms/7/share',
			SHARE,
		]);
		expect(requests[1].qs).toEqual(BY_EMAIL);
		expect(request(requests, SHARE).body).toEqual({ invitations: [{ id: 'u1', access: 0 }] });
		expect(output[0].json).toEqual(MEMBER);
	});

	it('by email sets no access for that email', async () => {
		const { requests } = await room(
			{ operation: 'removeUser', userEmail: 'a@example.com' },
			{ 'GET api/2.0/files/rooms/7/share': [MEMBER], [SHARE]: { members: [] } },
		);
		expect(request(requests, SHARE).body).toEqual({
			invitations: [{ email: 'a@example.com', access: 0 }],
		});
	});
});

describe('member operations', () => {
	it.each([
		['inviteUser', {}, 'Must provide either User ID or User Email'],
		['inviteUser', { userId: 'u1', userEmail: 'a@example.com' }, 'not both'],
		['updateUser', {}, 'Must provide either User ID or User Email'],
		['removeUser', { userId: 'u1', userEmail: 'a@example.com' }, 'not both'],
	])('%s %j fails before it calls the portal', async (operation, params, message) => {
		await expect(room({ operation, userAccess: 2, ...params }, {})).rejects.toThrow(message);
	});
});
