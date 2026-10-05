/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IExecuteFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import {
	docspaceJsonApiRequest,
	docspaceResolveAsyncApiResponse,
	docspaceResolveBaseUrl,
	docspaceResolveCredentialsType,
} from '../../nodes/OnlyofficeDocspace/GenericFunctions';
import { ACCESS_TOKEN, calls, genericContext, PORTAL, type Routes } from './helpers';

// Polling waits between attempts; the tests do not.
vi.mock('n8n-workflow', async (original) => ({
	...(await original<typeof import('n8n-workflow')>()),
	sleep: async () => {},
}));

const contextOf = (routes: Routes = {}, authentication = 'basicAuth') => {
	const { context, requests } = genericContext({ params: { authentication }, routes });
	return { context: context as unknown as IExecuteFunctions, requests };
};

// ---- Credentials ----

describe('docspaceResolveCredentialsType', () => {
	it.each([
		['apiKey', 'onlyofficeDocspaceApiKeyApi'],
		['basicAuth', 'onlyofficeDocspaceBasicAuthApi'],
		['oAuth2', 'onlyofficeDocspaceOAuth2Api'],
		['personalAccessToken', 'onlyofficeDocspacePersonalAccessTokenApi'],
	])('maps %s to %s', (authentication, type) => {
		expect(docspaceResolveCredentialsType.call(contextOf().context, authentication)).toBe(type);
	});

	it('rejects an unknown authentication', () => {
		expect(() => docspaceResolveCredentialsType.call(contextOf().context, 'none')).toThrow(
			'Unknown authentication none',
		);
	});
});

describe('docspaceResolveBaseUrl', () => {
	const resolve = (type: string, credentials: object) =>
		docspaceResolveBaseUrl.call(contextOf().context, type, credentials as never);

	it('normalizes the portal URL of the credentials', () => {
		expect(resolve('onlyofficeDocspaceApiKeyApi', { baseUrl: 'https://portal.example.com' })).toBe(
			PORTAL,
		);
	});

	it('takes the portal of OAuth2 from the audience of the access token', () => {
		const credentials = { oauthTokenData: { access_token: ACCESS_TOKEN } };
		expect(resolve('onlyofficeDocspaceOAuth2Api', credentials)).toBe(PORTAL);
	});

	it.each([
		[{}, 'No base URL configured'],
		[{ baseUrl: 'portal' }, 'Invalid base URL: portal'],
	])('fails for %j', (credentials, message) => {
		expect(() => resolve('onlyofficeDocspaceBasicAuthApi', credentials)).toThrow(message);
	});
});

// ---- Requests ----

describe('docspaceJsonApiRequest', () => {
	it('sends JSON to the portal with the credentials of the chosen authentication', async () => {
		const { context, requests } = contextOf({ 'PUT api/2.0/x': true }, 'apiKey');
		await docspaceJsonApiRequest.call(context, 0, 'PUT', 'api/2.0/x', { a: 1 }, { b: 2 });
		expect(requests).toEqual([
			{
				credentialsType: 'onlyofficeDocspaceApiKeyApi',
				url: 'api/2.0/x',
				baseURL: PORTAL,
				method: 'PUT',
				returnFullResponse: true,
				qs: { a: 1 },
				body: { b: 2 },
				headers: {
					Accept: 'application/json',
					'User-Agent': 'n8n',
					'Content-Type': 'application/json',
				},
			},
		]);
	});

	it('sends no body and no Content-Type for a GET', async () => {
		const { context, requests } = contextOf({ 'GET api/2.0/x': true });
		await docspaceJsonApiRequest.call(context, 0, 'GET', 'api/2.0/x');
		expect(requests[0]).not.toHaveProperty('body');
		expect(requests[0].headers).not.toHaveProperty('Content-Type');
	});
});

// ---- Async file operations ----

describe('docspaceResolveAsyncApiResponse', () => {
	const resolve = (routes: Routes, response: unknown) => {
		const { context, requests } = contextOf(routes);
		const result = docspaceResolveAsyncApiResponse.call(context, 0, { response });
		return { result, requests };
	};

	it('returns finished operations without polling', async () => {
		const { result, requests } = resolve({}, [{ id: 'a', progress: 100 }]);
		await expect(result).resolves.toEqual([{ id: 'a', progress: 100 }]);
		expect(requests).toEqual([]);
	});

	it('polls the operation list until every operation is finished', async () => {
		let polls = 0;
		const { result, requests } = resolve(
			{
				'GET api/2.0/files/fileops': () => ({
					body: { response: [{ id: 'other' }, { id: 'a', finished: ++polls === 2, files: [1] }] },
				}),
			},
			{ id: 'a', finished: false },
		);
		await expect(result).resolves.toEqual([{ id: 'a', finished: true, files: [1] }]);
		expect(calls(requests)).toEqual(['GET api/2.0/files/fileops', 'GET api/2.0/files/fileops']);
	});

	it('fails with the errors of the operations', async () => {
		const { result } = resolve({}, [
			{ id: 'a', error: 'Access denied' },
			{ id: 'b', error: 'Not found' },
		]);
		await expect(result).rejects.toThrow('Errors in operations: Access denied; Not found');
	});

	it('gives up after 20 polls', async () => {
		const { result, requests } = resolve({ 'GET api/2.0/files/fileops': [] }, [{ id: 'a' }]);
		await expect(result).rejects.toThrow('Timeout waiting for operations to finish');
		expect(requests).toHaveLength(20);
	});

	it('fails when there is no operation', async () => {
		await expect(resolve({}, []).result).rejects.toThrow('No input operations');
	});
});
