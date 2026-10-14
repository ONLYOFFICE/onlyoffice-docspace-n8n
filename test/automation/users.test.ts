/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- test code runs in Node/vitest, not in n8n */
import { describe, expect, it } from 'vitest';

import { runWorkflow } from './n8n';

const USERS = 'dsUsers000000001';

describe('Users and authentication', () => {
	it('Get User returns the current user', async () => {
		const run = await runWorkflow(USERS);
		expect(run.json('Me').email).toBe(process.env.DOC_SPACE_USERNAME);
	});

	it.each(['User By ID', 'User By Email'])('Get User finds the same user (%s)', async (node) => {
		const run = await runWorkflow(USERS);
		expect(run.json(node).id).toBe(run.json('Me').id);
	});

	it('Search User finds the user by email', async () => {
		const run = await runWorkflow(USERS);
		expect(run.items('Search Users').map((item) => item.json.id)).toEqual([run.json('Me').id]);
	});

	it('the API Key credential signs in as the same user', async () => {
		const run = await runWorkflow(USERS);
		expect(run.json('Me With API Key').id).toBe(run.json('Me').id);
	});

	it('a wrong API key fails with an authorization error', async () => {
		const run = await runWorkflow(USERS);
		expect(run.error('Me With Wrong API Key')).toBe(
			'Authorization failed - please check your credentials',
		);
	});
});
