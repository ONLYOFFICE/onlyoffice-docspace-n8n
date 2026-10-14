/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { calls, finished, PORTAL, reply, request, type Routes, runNode } from './helpers';

const file = (params: IDataObject, routes: Routes, extra = {}) =>
	runNode({ params: { resource: 'file', ...params }, routes, ...extra });

const INFO = { id: 1, title: 'Report.docx', fileExst: '.docx' };
const DOWNLOAD_URL = `${PORTAL}download/1`;

// ---- Create ----

describe('Create File', () => {
	it.each([
		['document', 'Report.docx'],
		['spreadsheet', 'Report.xlsx'],
		['presentation', 'Report.pptx'],
		['pdfForm', 'Report.pdf'],
	])('creates a %s named with the extension of its type', async (type, title) => {
		const { output, requests } = await file(
			{ operation: 'createFile', parentId: 5, type, title: 'Report' },
			{ 'POST api/2.0/files/5/file': { id: 1, title } },
		);
		expect(requests[0].body).toEqual({ title });
		expect(output).toEqual([{ json: { id: 1, title }, pairedItem: { item: 0 } }]);
	});

	it('creates the file in My Documents', async () => {
		const { requests } = await file(
			{ operation: 'createFile', isMyDocuments: true },
			{ 'GET api/2.0/files/@my': { current: { id: 3 } }, 'POST api/2.0/files/3/file': INFO },
		);
		expect(calls(requests)).toEqual(['GET api/2.0/files/@my', 'POST api/2.0/files/3/file']);
		expect(requests[0].qs).toEqual({ count: 1 });
	});
});

// ---- Simple requests ----

describe('file requests', () => {
	it.each([
		['getFileInfo', {}, 'GET api/2.0/files/file/1', undefined],
		['getFileSharedLink', {}, 'GET api/2.0/files/file/1/link', undefined],
		['updateFile', { title: 'New.docx' }, 'PUT api/2.0/files/file/1', { title: 'New.docx' }],
		// An empty title is left out, so the file keeps its name.
		['updateFile', { title: '' }, 'PUT api/2.0/files/file/1', {}],
	])('%s %j sends %s', async (operation, params, call, body) => {
		const { output, requests } = await file({ operation, fileId: 1, ...params }, { [call]: INFO });
		expect(calls(requests)).toEqual([call]);
		expect(requests[0].body).toEqual(body);
		expect(output[0].json).toEqual(INFO);
	});

	it('Delete File returns the file as it was before it went to the trash', async () => {
		const { output, requests } = await file(
			{ operation: 'deleteFile', fileId: 1 },
			{ 'GET api/2.0/files/file/1': INFO, 'DELETE api/2.0/files/file/1': finished() },
		);
		expect(request(requests, 'DELETE api/2.0/files/file/1').body).toEqual({
			deleteAfter: false,
			immediately: false,
		});
		expect(output[0].json).toEqual(INFO);
	});

	it.each([
		['copyFile', 'copy'],
		['moveFile', 'move'],
	])('%s keeps both files on a name conflict and returns the new file', async (operation, op) => {
		const { output, requests } = await file(
			{ operation, fileId: 1, destFolderId: 9 },
			{ [`PUT api/2.0/files/fileops/${op}`]: finished({ files: [{ id: 2, folderId: 9 }] }) },
		);
		expect(requests[0].body).toEqual({
			fileIds: [1],
			destFolderId: 9,
			conflictResolveType: 'Duplicate',
			deleteAfter: false,
		});
		expect(output[0].json).toEqual({ id: 2, folderId: 9 });
	});
});

// ---- Download ----

describe('Download File', () => {
	const download = (params: IDataObject, info = INFO, extra = {}) =>
		file(
			{ operation: 'downloadFile', fileId: 1, ...params },
			{
				'GET api/2.0/files/file/1': info,
				'GET api/2.0/files/settings': {
					extsConvertible: { '.docx': ['.pdf', '.txt'], '.png': [] },
				},
				'PUT api/2.0/files/fileops/bulkdownload': finished({ url: DOWNLOAD_URL }),
				[`GET ${DOWNLOAD_URL}`]: () => reply(Buffer.from('content')),
			},
			extra,
		);

	it('downloads the original file into the binary field', async () => {
		const { output, requests } = await download({ binaryPropertyName: 'file' });
		expect(request(requests, 'PUT api/2.0/files/fileops/bulkdownload').body).toEqual({
			fileIds: [1],
		});
		expect(output[0].json).toEqual(INFO);
		expect(output[0].binary?.file).toMatchObject({ fileName: 'Report.docx' });
		expect(Buffer.from(output[0].binary!.file.data, 'base64').toString()).toBe('content');
	});

	it('converts to the chosen format and renames the file', async () => {
		const { output, requests } = await download({ outputFormat: { mode: 'list', value: '.pdf' } });
		expect(request(requests, 'PUT api/2.0/files/fileops/bulkdownload').body).toEqual({
			fileConvertIds: [{ key: 1, value: '.pdf' }],
		});
		expect(output[0].binary?.data.fileName).toBe('Report.pdf');
	});

	it('As Text converts to the first text format the portal offers', async () => {
		const { output, requests } = await download({ asText: true });
		expect(request(requests, 'PUT api/2.0/files/fileops/bulkdownload').body).toEqual({
			fileConvertIds: [{ key: 1, value: '.txt' }],
		});
		expect(output[0].binary?.data.fileName).toBe('Report.txt');
	});

	it('As Text downloads a text file as is', async () => {
		const { requests } = await download(
			{ asText: true },
			{ ...INFO, title: 'a.txt', fileExst: '.txt' },
		);
		expect(calls(requests)).not.toContain('GET api/2.0/files/settings');
		expect(request(requests, 'PUT api/2.0/files/fileops/bulkdownload').body).toEqual({
			fileIds: [1],
		});
	});

	it('As Text fails for a file without a text format', async () => {
		const result = download({ asText: true }, { ...INFO, title: 'a.png', fileExst: '.png' });
		await expect(result).rejects.toThrow('File could not be converted to text');
	});

	it('keeps the JSON and the other binaries of the input item', async () => {
		const items = [
			{ json: { keep: true }, binary: { other: { data: '', mimeType: 'text/plain' } } },
		];
		const { output } = await download({}, INFO, { items });
		expect(output[0].json).toEqual({ keep: true });
		expect(Object.keys(output[0].binary!)).toEqual(['other', 'data']);
	});
});

// ---- Upload ----

describe('Upload File', () => {
	const MB = 1024 * 1024;

	/** Upload with a fake chunked uploader that completes a file every `chunks` chunks. */
	async function upload(params: IDataObject, items?: IDataObject[], chunks = 1) {
		let received = 0;
		const result = await file(
			{ operation: 'uploadFile', parentId: 5, ...params },
			{
				'POST api/2.0/files/5/upload/create_session': { data: { id: 's1' } },
				'POST ChunkedUploader.ashx?uid=s1': () =>
					++received % chunks === 0 ? reply({ data: { id: 7 } }, 201) : reply({ success: true }),
				'GET api/2.0/files/file/7': { id: 7, title: 'notes.txt' },
			},
			{ items },
		);
		const chunksSent = result.requests.filter((r) => r.url.startsWith('ChunkedUploader'));
		return { ...result, chunksSent };
	}

	const blobOf = (form: FormData) => form.get('file') as File;

	it('uploads text content as a text file and returns the uploaded file', async () => {
		const { output, requests, chunksSent } = await upload({
			fileName: 'notes.txt',
			fileContent: 'Привет',
		});
		expect(requests[0].body).toEqual({
			fileName: 'notes.txt',
			fileSize: Buffer.byteLength('Привет'),
			createOn: expect.any(String),
		});
		expect(chunksSent[0].baseURL).toBe(PORTAL);
		const blob = blobOf(chunksSent[0].body!);
		expect([blob.name, blob.type, await blob.text()]).toEqual([
			'notes.txt',
			'text/plain',
			'Привет',
		]);
		expect(output[0].json).toEqual({ id: 7, title: 'notes.txt' });
	});

	const binaryItem = (size: number) => ({
		json: {},
		binary: {
			data: {
				data: Buffer.alloc(size, 1).toString('base64'),
				fileName: 'in.docx',
				mimeType: 'application/octet-stream',
			},
		},
	});

	it('uploads a binary under its own file name unless a name is given', async () => {
		const own = await upload({ binaryData: true }, [binaryItem(3)]);
		expect(own.requests[0].body).toMatchObject({ fileName: 'in.docx', fileSize: 3 });
		const named = await upload({ binaryData: true, fileName: 'out.docx' }, [binaryItem(3)]);
		expect(named.requests[0].body).toMatchObject({ fileName: 'out.docx' });
		expect(blobOf(named.chunksSent[0].body!).type).toBe('application/octet-stream');
	});

	it('sends a file over 10 MB in 10 MB chunks', async () => {
		const { chunksSent } = await upload({ binaryData: true }, [binaryItem(10 * MB + 1)], 2);
		expect(chunksSent.map((r) => blobOf(r.body!).size)).toEqual([10 * MB, 1]);
	});

	it('sends the chunks of each item with the credentials of that item', async () => {
		const { chunksSent } = await upload({ fileName: 'a.txt', fileContent: 'x' }, [
			{ json: {} },
			{ json: {} },
		]);
		expect(chunksSent.map((r) => r.itemIndex)).toEqual([0, 1]);
	});

	it('fails without a file name before it calls the portal', async () => {
		const result = file({ operation: 'uploadFile', parentId: 5, fileContent: 'x' }, {});
		await expect(result).rejects.toThrow('File name is not set');
	});

	it('fails when the portal does not complete the upload', async () => {
		await expect(upload({ fileName: 'a.txt' }, undefined, 2)).rejects.toThrow(
			'Upload session not completed',
		);
	});
});

// ---- Errors ----

describe('errors', () => {
	const failingInfo = () => {
		let call = 0;
		return {
			'GET api/2.0/files/file/1': () => {
				if (++call === 1) throw new Error('Request failed with status code 404');
				return reply({ response: INFO });
			},
		};
	};

	it('stop the node with the API error', async () => {
		await expect(file({ operation: 'getFileInfo', fileId: 1 }, failingInfo())).rejects.toThrow(
			'Request failed with status code 404',
		);
	});

	it('become an error item per failed item with Continue On Fail', async () => {
		const { output } = await file({ operation: 'getFileInfo', fileId: 1 }, failingInfo(), {
			items: [{ json: {} }, { json: {} }],
			continueOnFail: true,
		});
		expect(output.map((item) => item.json)).toEqual([
			{ error: 'Request failed with status code 404' },
			INFO,
		]);
	});
});
