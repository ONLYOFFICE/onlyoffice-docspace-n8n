/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { calls, type Routes, runNode } from './helpers';

const user = (params: IDataObject, routes: Routes) =>
	runNode({ params: { resource: 'user', ...params }, routes });

const USER = { id: 'u1', email: 'a@example.com' };

describe('user requests', () => {
	it.each([
		['getUser', { isMe: true }, ['GET api/2.0/people/@self'], undefined, undefined],
		['getUser', { userId: 'u1' }, ['GET api/2.0/people/u1'], undefined, undefined],
		[
			'getUser',
			{ userEmail: 'a@example.com' },
			['GET api/2.0/people/email'],
			{ email: 'a@example.com' },
			undefined,
		],
		[
			'searchUser',
			{ query: 'Al' },
			['GET api/2.0/people/filter'],
			{ filterValue: 'Al' },
			undefined,
		],
		['deleteUser', { userId: 'u1' }, ['PUT api/2.0/people/delete'], undefined, { userIds: ['u1'] }],
		[
			'disableUser',
			{ userId: 'u1' },
			['PUT api/2.0/people/status/2', 'GET api/2.0/people/u1'],
			undefined,
			{ userIds: ['u1'] },
		],
		[
			'enableUser',
			{ userId: 'u1' },
			['PUT api/2.0/people/status/1', 'GET api/2.0/people/u1'],
			undefined,
			{ userIds: ['u1'] },
		],
	])('%s %j sends %j', async (operation, params, expected, qs, body) => {
		const routes = Object.fromEntries(expected.map((call) => [call, USER]));
		const { output, requests } = await user({ operation, ...params }, routes);
		expect(calls(requests)).toEqual(expected);
		expect([requests[0].qs, requests[0].body]).toEqual([qs, body]);
		expect(output[0].json).toEqual(USER);
	});

	it.each([
		[{}, 'Must provide either User ID or User Email'],
		[{ userId: 'u1', userEmail: 'a@example.com' }, 'not both'],
	])('Get User %j fails before it calls the portal', async (params, message) => {
		await expect(user({ operation: 'getUser', ...params }, {})).rejects.toThrow(message);
	});

	it('Invite User invites by email and returns the new user', async () => {
		const { output, requests } = await user(
			{ operation: 'inviteUser', type: 4, email: 'a@example.com', culture: 'de' },
			{ 'POST api/2.0/people/invite': [], 'GET api/2.0/people/filter': [USER] },
		);
		expect(requests[0].body).toEqual({
			invitations: [{ type: 4, email: 'a@example.com' }],
			culture: 'de',
		});
		expect(requests[1].qs).toEqual({
			count: 1,
			filterBy: 'email',
			filterOp: 'equals',
			filterValue: 'a@example.com',
		});
		expect(output[0].json).toEqual(USER);
	});
});

// ---- Update User: the portal has one endpoint to raise a user type and another to lower it ----

describe('Update User', () => {
	const OWNER = { isOwner: true };
	const ROOM_ADMIN = { id: 'u1', isRoomAdmin: true };
	const GUEST = { id: 'u1', isVisitor: true };

	const update = (self: IDataObject, target: IDataObject, type: number) =>
		user(
			{ operation: 'updateUser', userId: 'u1', type },
			{
				'GET api/2.0/people/@self': self,
				'GET api/2.0/people/u1': target,
				'POST api/2.0/people/type': {},
				[`PUT api/2.0/people/type/${type}`]: {},
			},
		);

	it('lowers a room admin to a guest with POST people/type', async () => {
		const { output, requests } = await update(OWNER, ROOM_ADMIN, 2);
		expect(calls(requests)).toEqual([
			'GET api/2.0/people/@self',
			'GET api/2.0/people/u1',
			'POST api/2.0/people/type',
			'GET api/2.0/people/u1',
		]);
		expect(requests[2].body).toEqual({ type: 2, userId: 'u1' });
		expect(output[0].json).toEqual(ROOM_ADMIN);
	});

	it('raises a guest to a room admin with PUT people/type/{type}', async () => {
		const { requests } = await update(OWNER, GUEST, 1);
		expect(calls(requests)[2]).toBe('PUT api/2.0/people/type/1');
		expect(requests[2].body).toEqual({ userIds: ['u1'] });
	});

	it.each([
		[
			{ isRoomAdmin: true },
			ROOM_ADMIN,
			3,
			'Insufficient permissions or unsupported employee type transition',
		],
		[{}, ROOM_ADMIN, 2, 'Unknown employee type of current user'],
		[OWNER, { id: 'u1' }, 2, 'Unknown employee type of user u1'],
	])(
		'fails for self %j, target %j, type %i without changing the user',
		async (self, target, type, message) => {
			const result = update(self, target, type);
			await expect(result).rejects.toThrow(message);
		},
	);
});
