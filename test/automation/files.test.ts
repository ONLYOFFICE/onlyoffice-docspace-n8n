/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, inject, it } from 'vitest';

import { DOC_SPACE_BASE_URL, trash } from './docspace';
import { runWorkflow, startsWith } from './n8n';

const ROOM_ID = Number(inject('n8n').env.TEST_ROOM_ID);
const FILES = 'dsFiles000000001';
const TRANSFER = 'dsTransfer000001';

describe('Files', () => {
	it('Create File creates a document of the chosen type in the room', async () => {
		const run = await runWorkflow(FILES);
		expect(run.json('Create File')).toMatchObject({
			title: 'Report.docx',
			fileExst: '.docx',
			folderId: ROOM_ID,
		});
	});

	it('Get File Info returns the file', async () => {
		const run = await runWorkflow(FILES);
		expect(run.json('Get File Info')).toMatchObject({ id: run.json('Create File').id });
	});

	it('Update File renames the file', async () => {
		const run = await runWorkflow(FILES);
		expect(run.json('Update File')).toMatchObject({ title: 'Renamed.docx' });
	});

	it('Get File Shared Link returns the external link of the file', async () => {
		const run = await runWorkflow(FILES);
		const link = run.json('Get File Shared Link').sharedTo as { shareLink: string };
		expect(link.shareLink.startsWith(`${new URL(DOC_SPACE_BASE_URL).origin}/s/`)).toBe(true);
	});

	it('Copy File puts a new file into the folder', async () => {
		const run = await runWorkflow(FILES);
		const copy = run.json('Copy File');
		expect(copy.id).not.toBe(run.json('Create File').id);
		expect(copy.folderId).toBe(run.json('Create Target Folder').id);
	});

	it('Move File puts the file itself into the folder', async () => {
		const run = await runWorkflow(FILES);
		expect(run.json('Move File')).toMatchObject({
			id: run.json('Create File').id,
			folderId: run.json('Create Target Folder').id,
		});
	});

	it('Delete File moves the file to the trash and returns it', async () => {
		const run = await runWorkflow(FILES);
		const { id } = run.json('Delete File');
		expect(id).toBe(run.json('Create File').id);
		expect((await trash()).files.map((file) => file.id)).toContain(id);
	});

	it('a missing file fails with the message of the portal', async () => {
		const run = await runWorkflow(FILES);
		expect(run.error('Missing File')).toBe('The resource you are requesting could not be found');
	});
});

describe('Upload and download', () => {
	it('Upload File stores text content as a file', async () => {
		const run = await runWorkflow(TRANSFER);
		expect(run.json('Upload Text')).toMatchObject({
			title: 'notes.txt',
			folderId: ROOM_ID,
			pureContentLength: 14,
		});
	});

	it('Download File As Text returns a text file as is', async () => {
		const run = await runWorkflow(TRANSFER);
		expect(run.fileName('Download Text')).toBe('notes.txt');
		expect(run.file('Download Text').toString()).toBe('Hello from n8n');
	});

	it('Download File returns the original document', async () => {
		const run = await runWorkflow(TRANSFER);
		expect(run.fileName('Download DOCX')).toBe('Document.docx');
		expect(startsWith(run.file('Download DOCX'), 'PK')).toBe(true);
	});

	it('Upload File stores the binary of a previous node', async () => {
		const run = await runWorkflow(TRANSFER);
		expect(run.json('Upload DOCX')).toMatchObject({
			title: 'Copy.docx',
			pureContentLength: run.file('Download DOCX').length,
		});
	});

	it('Download File converts to the chosen format', async () => {
		const run = await runWorkflow(TRANSFER);
		expect(run.fileName('Download PDF')).toBe('Document.pdf');
		expect(startsWith(run.file('Download PDF'), '%PDF')).toBe(true);
	});

	it('Download File As Text converts a document to text', async () => {
		const run = await runWorkflow(TRANSFER);
		expect(run.fileName('Download Document As Text')).toBe('Document.txt');
	});
});
