/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, it } from 'vitest';

import { OnlyofficeDocspaceApiKeyApi } from '../../credentials/OnlyofficeDocspaceApiKeyApi.credentials';
import { OnlyofficeDocspaceBasicAuthApi } from '../../credentials/OnlyofficeDocspaceBasicAuthApi.credentials';
import { OnlyofficeDocspaceOAuth2Api } from '../../credentials/OnlyofficeDocspaceOAuth2Api.credentials';
import { OnlyofficeDocspacePersonalAccessTokenApi } from '../../credentials/OnlyofficeDocspacePersonalAccessTokenApi.credentials';

describe('credentials', () => {
	it.each([
		[
			'API key as a Bearer token',
			new OnlyofficeDocspaceApiKeyApi(),
			{
				headers: { Authorization: '=Bearer {{$credentials?.apiKey}}' },
			},
		],
		[
			'email and password as basic auth',
			new OnlyofficeDocspaceBasicAuthApi(),
			{
				auth: { username: '={{$credentials?.email}}', password: '={{$credentials?.password}}' },
			},
		],
		// DocSpace takes its own auth tokens without the Bearer prefix.
		[
			'personal access token as is',
			new OnlyofficeDocspacePersonalAccessTokenApi(),
			{
				headers: { Authorization: '={{$credentials?.personalAccessToken}}' },
			},
		],
	])('send the %s', (_kind, credential, properties) => {
		expect(credential.authenticate).toEqual({ type: 'generic', properties });
	});

	it.each([
		new OnlyofficeDocspaceApiKeyApi(),
		new OnlyofficeDocspaceBasicAuthApi(),
		new OnlyofficeDocspacePersonalAccessTokenApi(),
	])('$name is tested against the authentication endpoint of the portal', (credential) => {
		expect(credential.test.request).toEqual({
			url: 'api/2.0/authentication',
			baseURL: '={{$credentials?.baseUrl}}',
		});
		expect(credential.test.rules?.[0]).toMatchObject({
			type: 'responseSuccessBody',
			properties: { key: 'response', value: false },
		});
	});

	it('OAuth2 builds its URLs from the authorization base URL and asks for every scope', () => {
		const properties = Object.fromEntries(
			new OnlyofficeDocspaceOAuth2Api().properties.map((p) => [p.name, p.default]),
		);
		expect(properties.authUrl).toMatch(/\/oauth2\/authorize$/);
		expect(properties.accessTokenUrl).toMatch(/\/oauth2\/token$/);
		expect(String(properties.scope).split(' ')).toEqual(
			expect.arrayContaining(['files:write', 'rooms:write', 'accounts:write']),
		);
	});
});
