import type { ICredentialType, INodeProperties } from 'n8n-workflow';

const scopes: string[] = [
	'files:read',
	'files:write',
	'rooms:read',
	'rooms:write',
];

export class OnlyofficeOAuth2Api implements ICredentialType {
	name = 'onlyofficeOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'ONLYOFFICE DocSpace OAuth2 API';

	documentationUrl = 'onlyoffice';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			description: 'The base URL of your ONLYOFFICE DocSpace portal',
			placeholder: 'https://yourportal.onlyoffice.com',
			required: true,
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default:
				'={{$self["baseUrl"].endsWith("/") ? $self["baseUrl"].slice(0, -1) : $self["baseUrl"]}}/oauth2/authorize',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default:
				'={{$self["baseUrl"].endsWith("/") ? $self["baseUrl"].slice(0, -1) : $self["baseUrl"]}}/oauth2/token',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: scopes.join(' '),
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
