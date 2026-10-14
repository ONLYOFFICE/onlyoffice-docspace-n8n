import { createHmac } from 'node:crypto';
import type { IDataObject } from 'n8n-workflow';

import { WEBHOOK_URL } from './helpers';

export const SECRET_KEY = 'secretkey';
const USER_ID = '00000000-0000-4000-8000-000000000001';

/** A delivery as DocSpace sends it: the trigger, the changed entity and the webhook. */
const delivery = (trigger: string, triggerId: number, payload: IDataObject) => ({
	event: { id: 1, createOn: '2026-10-02T09:06:56Z', createBy: USER_ID, trigger, triggerId },
	payload,
	webhook: { id: 42, name: 'n8n', url: WEBHOOK_URL, triggers: [trigger] },
});

// Payloads of DocSpace 3.7, shortened.
export const FILE_CREATED = delivery('file.created', 128, {
	id: 5,
	parentId: 4,
	folderIdDisplay: 4,
	rootId: 3,
	title: 'Report.docx',
	createBy: USER_ID,
	createOn: '2026-10-02T09:06:57Z',
	rootFolderType: 14,
	fileEntryType: 2,
});

export const ROOM_CREATED = delivery('room.created', 4194304, {
	id: 4,
	title: 'Team',
	roomType: 2,
	rootFolderType: 14,
	fileEntryType: 1,
});

export const USER_INVITED = delivery('user.invited', 2, {
	id: '00000000-0000-4000-8000-000000000002',
	email: 'guest@example.com',
	activationStatus: 2,
});

/** The x-docspace-signature-256 header: HMAC-SHA256 of the raw body, upper-case hex. */
export function signature(body: IDataObject, secretKey = SECRET_KEY) {
	const hash = createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex');
	return `sha256=${hash.toUpperCase()}`;
}
