/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { calls, finished, request, type Routes, runNode } from './helpers';

const folder = (params: IDataObject, routes: Routes) =>
	runNode({ params: { resource: 'folder', ...params }, routes });

const INFO = { id: 5, title: 'Reports' };
const MY = { 'GET api/2.0/files/@my': { current: { id: 3 } } };

describe('folder requests', () => {
	it.each([
		[
			'createFolder',
			{ parentId: 2, title: 'A' },
			'POST api/2.0/files/folder/2',
			undefined,
			{ title: 'A' },
		],
		['getFolderInfo', {}, 'GET api/2.0/files/folder/5', undefined, undefined],
		['getFolderSharedLink', {}, 'GET api/2.0/files/folder/5/link', undefined, undefined],
		[
			'getFolderContents',
			{ query: 'rep' },
			'GET api/2.0/files/5',
			{ filterValue: 'rep' },
			undefined,
		],
		['getFolderContents', {}, 'GET api/2.0/files/5', {}, undefined],
		[
			'getFolderHistory',
			{ fromDate: '2026-01-01', toDate: '' },
			'GET api/2.0/files/folder/5/log',
			{ fromDate: '2026-01-01' },
			undefined,
		],
		['updateFolder', { title: 'B' }, 'PUT api/2.0/files/folder/5', undefined, { title: 'B' }],
		['updateFolder', { title: '' }, 'PUT api/2.0/files/folder/5', undefined, {}],
	])('%s %j sends %s', async (operation, params, call, qs, body) => {
		const { output, requests } = await folder(
			{ operation, folderId: 5, ...params },
			{ [call]: INFO },
		);
		expect(calls(requests)).toEqual([call]);
		expect([requests[0].qs, requests[0].body]).toEqual([qs, body]);
		expect(output[0].json).toEqual(INFO);
	});

	it.each([
		['createFolder', ['GET api/2.0/files/@my', 'POST api/2.0/files/folder/3']],
		['getFolderInfo', ['GET api/2.0/files/@my', 'GET api/2.0/files/folder/3']],
		// The contents endpoint takes @my itself.
		['getFolderContents', ['GET api/2.0/files/@my']],
	])('%s works on My Documents', async (operation, expected) => {
		const routes = {
			...MY,
			'POST api/2.0/files/folder/3': INFO,
			'GET api/2.0/files/folder/3': INFO,
		};
		const { requests } = await folder({ operation, isMyDocuments: true }, routes);
		expect(calls(requests)).toEqual(expected);
	});

	it('Delete Folder returns the folder as it was before it went to the trash', async () => {
		const { output, requests } = await folder(
			{ operation: 'deleteFolder', folderId: 5 },
			{ 'GET api/2.0/files/folder/5': INFO, 'DELETE api/2.0/files/folder/5': finished() },
		);
		expect(request(requests, 'DELETE api/2.0/files/folder/5').body).toEqual({
			deleteAfter: false,
			immediately: false,
		});
		expect(output[0].json).toEqual(INFO);
	});

	// A finished copy or move lists the destination folder too, in the order the portal answers.
	const DEST = { id: 9, parentId: 2 };
	const MOVED = { id: 5, parentId: 9 };
	const COPY = { id: 6, parentId: 9 };

	it.each([
		['copyFolder', 'copy'],
		['moveFolder', 'move'],
	])('%s keeps both folders on a name conflict', async (operation, op) => {
		const { requests } = await folder(
			{ operation, folderId: 5, destFolderId: 9 },
			{ [`PUT api/2.0/files/fileops/${op}`]: finished({ folders: [MOVED, DEST] }) },
		);
		expect(requests[0].body).toEqual({
			folderIds: [5],
			destFolderId: 9,
			conflictResolveType: 'Duplicate',
			deleteAfter: false,
		});
	});

	it('Move Folder returns the moved folder', async () => {
		const { output } = await folder(
			{ operation: 'moveFolder', folderId: 5, destFolderId: 9 },
			{ 'PUT api/2.0/files/fileops/move': finished({ folders: [MOVED, DEST] }) },
		);
		expect(output[0].json).toEqual(MOVED);
	});

	it('Copy Folder returns the copy, not the destination folder', async () => {
		const { output } = await folder(
			{ operation: 'copyFolder', folderId: 5, destFolderId: 9 },
			{ 'PUT api/2.0/files/fileops/copy': finished({ folders: [DEST, COPY] }) },
		);
		expect(output[0].json).toEqual(COPY);
	});

	it('Move Folder to My Documents resolves its ID first', async () => {
		const { requests } = await folder(
			{ operation: 'moveFolder', folderId: 5, isMyDocuments: true },
			{ ...MY, 'PUT api/2.0/files/fileops/move': finished({ folders: [INFO] }) },
		);
		expect(requests[1].body).toMatchObject({ destFolderId: 3 });
	});
});
