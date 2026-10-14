/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, it } from 'vitest';

import { runListSearch } from './helpers';

const ROOM = { roomId: { mode: 'list', value: 7 } };
const values = (results: Array<{ value: unknown }>) => results.map((r) => r.value);

describe('list search', () => {
	it('Rooms lists the rooms matching the filter', async () => {
		const { results, requests } = await runListSearch(
			'listRooms',
			{
				params: {},
				routes: { 'GET api/2.0/files/rooms': { folders: [{ id: 7, title: 'Team' }] } },
			},
			'Te',
		);
		expect(requests[0].qs).toEqual({ filterValue: 'Te' });
		expect(results).toEqual([{ name: 'Team', value: 7 }]);
	});

	it.each([
		[2, 'a collaboration room', [2, 9, 10, 11]],
		[undefined, 'an unknown room type', [2, 5, 6, 7, 9, 10, 11]],
	])('Access Levels for room type %s offers the roles of %s', async (roomType, _kind, expected) => {
		const { results } = await runListSearch('listAccessLevels', {
			params: ROOM,
			routes: { 'GET api/2.0/files/rooms/7': { roomType } },
		});
		expect(values(results)).toEqual(expected);
	});

	it('Access Levels filters by name', async () => {
		const { results } = await runListSearch(
			'listAccessLevels',
			{ params: ROOM, routes: { 'GET api/2.0/files/rooms/7': { roomType: 2 } } },
			'edit',
		);
		expect(values(results)).toEqual([10]);
	});

	it('Convertible lists the formats the portal converts the file to', async () => {
		const { results } = await runListSearch(
			'listConvertible',
			{
				params: { fileId: 1 },
				routes: {
					'GET api/2.0/files/file/1': { fileExst: '.docx' },
					'GET api/2.0/files/settings': { extsConvertible: { '.docx': ['.pdf', '.odt'] } },
				},
			},
			'pd',
		);
		expect(results).toEqual([{ name: '.pdf', value: '.pdf' }]);
	});

	it.each([
		[
			'listConvertible',
			{ fileId: 0 },
			'The ID of the file to get convertible formats for is required',
		],
		[
			'listRoomUsers',
			{ roomId: { mode: 'list', value: '' } },
			'The ID of the room to get users for is required',
		],
	] as const)('%s fails without its parameter', async (method, params, message) => {
		await expect(runListSearch(method, { params })).rejects.toThrow(message);
	});

	it.each([
		['listInvitableUsers', { excludeShared: true }],
		['listRemovableUsers', { includeShared: true }],
	] as const)('%s asks the room for users with %j', async (method, qs) => {
		const { results, requests } = await runListSearch(method, {
			params: ROOM,
			routes: { 'GET api/2.0/people/room/7': [{ id: 'u1', displayName: 'Alice' }] },
		});
		expect(requests[0].qs).toEqual(qs);
		expect(results).toEqual([{ name: 'Alice', value: 'u1' }]);
	});

	it('Room Users lists the members of the room', async () => {
		const { results } = await runListSearch('listRoomUsers', {
			params: ROOM,
			routes: {
				'GET api/2.0/files/rooms/7/share': [{ sharedTo: { id: 'u1', displayName: 'Alice' } }],
			},
		});
		expect(results).toEqual([{ name: 'Alice', value: 'u1' }]);
	});

	it.each([
		['listEnabledUsers', 'GET api/2.0/people/status/5/search'],
		['listDisabledUsers', 'GET api/2.0/people/status/2/search'],
	] as const)('%s searches users by status, all of them without a filter', async (method, call) => {
		const { requests } = await runListSearch(method, { params: {}, routes: { [call]: [] } });
		expect(requests[0].qs).toEqual({ query: '@' });
	});
});
