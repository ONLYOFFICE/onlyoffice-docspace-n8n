/* eslint-disable @n8n/community-nodes/no-restricted-globals -- test code runs in Node/vitest, not in n8n */

/** The test portal. Its address and account come from the environment. */
export const DOC_SPACE_BASE_URL = process.env.DOC_SPACE_BASE_URL ?? '';
const AUTHORIZATION = `Basic ${Buffer.from(
	`${process.env.DOC_SPACE_USERNAME}:${process.env.DOC_SPACE_PASSWORD}`,
).toString('base64')}`;

/** Call the DocSpace API directly, to prepare and check what the workflows do. */
export async function docspace<T>(method: string, path: string, body?: object): Promise<T> {
	const response = await fetch(new URL(path, DOC_SPACE_BASE_URL), {
		method,
		headers: {
			Authorization: AUTHORIZATION,
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: body && JSON.stringify(body),
	});
	const json = (await response.json().catch(() => ({}))) as { response: T };
	if (!response.ok)
		throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(json)}`);
	return json.response;
}

export interface Entry {
	id: number;
	title: string;
}

/** Contents of a folder or a list of rooms. */
export interface Contents {
	files: Entry[];
	folders: Entry[];
}

export const trash = () => docspace<Contents>('GET', 'api/2.0/files/@trash');

export type Operation = { id: string; finished: boolean; error: string };

/** Wait until the file operations a request started are finished. */
export async function finished(started: Operation | Operation[]) {
	const ids = [started].flat().map((operation) => operation.id);
	// Usually a second; a loaded portal once needed more than 30.
	for (let attempt = 0; attempt < 240; attempt++) {
		const all = await docspace<Operation[]>('GET', 'api/2.0/files/fileops');
		const mine = all.filter((operation) => ids.includes(operation.id));
		const failed = mine.find((operation) => operation.error);
		if (failed) throw new Error(`File operation failed: ${failed.error}`);
		if (mine.every((operation) => operation.finished)) return;
		await sleep(500);
	}
	throw new Error('File operations did not finish');
}

export const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Call `check` until it returns a value. */
export async function poll<T>(check: () => Promise<T | undefined>, seconds: number, what: string) {
	for (let elapsed = 0; elapsed < seconds; elapsed++) {
		const value = await check();
		if (value !== undefined) return value;
		await sleep(1000);
	}
	throw new Error(`Timed out waiting for ${what}`);
}
