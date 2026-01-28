// These functions were written as part of the core n8n repository, so they
// follow the same patterns used in other n8n plugins, including the use of any.
// While removing any is not feasible in the current implementation, it would be
// a worthwhile improvement in future.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeOperationError, sleep } from 'n8n-workflow';

type Jwt = {
	header: object;
	payload: {
		aud: string;
	};
	signature: string;
};

function decodeJwt(token: string): Jwt {
	const parts = token.split('.');
	if (parts.length !== 3) {
		throw new Error('Invalid JWT format');
	}
	const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
	const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
	const object: Jwt = {
		header,
		payload,
		signature: parts[2],
	};
	return object;
}

export function docspaceResolveCredentialsType(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	authentication: string,
): string {
	switch (authentication) {
		case 'apiKey':
			return 'onlyofficeDocspaceApiKeyApi';
		case 'basicAuth':
			return 'onlyofficeDocspaceBasicAuthApi';
		case 'oAuth2':
			return 'onlyofficeDocspaceOAuth2Api';
		case 'personalAccessToken':
			return 'onlyofficeDocspacePersonalAccessTokenApi';
		default:
			throw new NodeOperationError(this.getNode(), `Unknown authentication ${authentication}`);
	}
}

export function docspaceResolveBaseUrl(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	credentialsType: string,
	credentials: ICredentialDataDecryptedObject,
): string {
	let baseUrl: unknown;
	switch (credentialsType) {
		case 'onlyofficeDocspaceApiKeyApi': {
			baseUrl = credentials.baseUrl;
			break;
		}
		case 'onlyofficeDocspaceBasicAuthApi': {
			baseUrl = credentials.baseUrl;
			break;
		}
		case 'onlyofficeDocspaceOAuth2Api': {
			const oauthTokenData = credentials.oauthTokenData as any;
			const token = decodeJwt(oauthTokenData.access_token);
			baseUrl = token.payload.aud;
			break;
		}
		case 'onlyofficeDocspacePersonalAccessTokenApi': {
			baseUrl = credentials.baseUrl;
			break;
		}
		default: {
			throw new NodeOperationError(this.getNode(), `Unknown credentials type ${credentialsType}`);
		}
	}
	if (!baseUrl) {
		throw new NodeOperationError(this.getNode(), 'No base URL configured');
	}
	if (typeof baseUrl !== 'string') {
		throw new NodeOperationError(
			this.getNode(),
			`Expected base URL to be a string, got ${typeof baseUrl}`,
		);
	}
	try {
		const url = new URL(baseUrl);
		return url.toString();
	} catch {
		throw new NodeOperationError(this.getNode(), `Invalid base URL: ${baseUrl}`);
	}
}

export async function docspaceBufferApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	i: number,
	method: Exclude<IHttpRequestOptions['method'], undefined>,
	url: string,
): Promise<any> {
	const authentication = this.getNodeParameter('authentication', i) as string;
	const credentialsType = docspaceResolveCredentialsType.call(this, authentication);
	const headers: IDataObject = {
		Accept: 'application/octet-stream',
		'User-Agent': 'n8n',
	};
	const requestOptions: IHttpRequestOptions = {
		url,
		method,
		encoding: 'arraybuffer',
		returnFullResponse: true,
	};
	requestOptions.headers = headers;
	const responseData = await this.helpers.httpRequestWithAuthentication.call(
		this,
		credentialsType,
		requestOptions,
	);
	return responseData;
}

export async function docspaceFormDataApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	i: number,
	url: string,
	body: FormData,
): Promise<any> {
	const authentication = this.getNodeParameter('authentication', i) as string;
	const credentialsType = docspaceResolveCredentialsType.call(this, authentication);
	const credentials = await this.getCredentials(credentialsType, i);
	const baseUrl = docspaceResolveBaseUrl.call(this, credentialsType, credentials);
	const headers: IDataObject = {
		Accept: 'application/json',
		'User-Agent': 'n8n',
	};
	const requestOptions: IHttpRequestOptions = {
		url,
		baseURL: baseUrl,
		method: 'POST',
		body,
		returnFullResponse: true,
	};
	requestOptions.headers = headers;
	const responseData = await this.helpers.httpRequestWithAuthentication.call(
		this,
		credentialsType,
		requestOptions,
	);
	return responseData;
}

export async function docspaceJsonApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	i: number,
	method: Exclude<IHttpRequestOptions['method'], undefined>,
	url: string,
	qs?: IDataObject,
	body?: object,
): Promise<any> {
	const authentication = this.getNodeParameter('authentication', i) as string;
	const credentialsType = docspaceResolveCredentialsType.call(this, authentication);
	const credentials = await this.getCredentials(credentialsType, i);
	const baseUrl = docspaceResolveBaseUrl.call(this, credentialsType, credentials);
	const headers: IDataObject = {
		Accept: 'application/json',
		'User-Agent': 'n8n',
	};
	const requestOptions: IHttpRequestOptions = {
		url,
		baseURL: baseUrl,
		method,
		returnFullResponse: true,
	};
	if (qs !== undefined) {
		requestOptions.qs = qs;
	}
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
		requestOptions.body = body;
	}
	requestOptions.headers = headers;
	const responseData = await this.helpers.httpRequestWithAuthentication.call(
		this,
		credentialsType,
		requestOptions,
	);
	return responseData;
}

export async function docspaceResolveAsyncApiResponse(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	i: number,
	data: any,
): Promise<any> {
	const ATTEMPTS = 20;
	const DELAY = 100;
	const operations: any[] = [];
	if (Array.isArray(data.response)) {
		operations.push.apply(operations, data.response);
	} else {
		operations.push(data.response);
	}
	if (operations.length === 0) {
		throw new NodeOperationError(this.getNode(), 'No input operations');
	}
	let finished = 0;
	let errors = '';
	for (const operation of operations) {
		if (operation.error) {
			errors += `${operation.error}; `;
		}
		if ((operation.progress && operation.progress === 100) || operation.finished) {
			finished++;
		}
	}
	if (errors) {
		errors = errors.slice(0, -2);
		throw new NodeOperationError(this.getNode(), `Errors in operations: ${errors}`);
	}
	if (finished === operations.length) {
		return operations;
	}
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const response = await docspaceJsonApiRequest.call(this, i, 'GET', 'api/2.0/files/fileops');
		for (const [index, operation] of operations.entries()) {
			for (const item of response.body.response) {
				if (item.id === operation.id) {
					operations[index] = item;
					break;
				}
			}
		}
		finished = 0;
		errors = '';
		for (const operation of operations) {
			if (operation.error) {
				errors += `${operation.error}; `;
			}
			if ((operation.progress && operation.progress === 100) || operation.finished) {
				finished++;
			}
		}
		if (errors) {
			errors = errors.slice(0, -2);
			throw new NodeOperationError(this.getNode(), `Errors in operations: ${errors}`);
		}
		if (finished === operations.length) {
			return operations;
		}
		if (attempt !== 19) {
			await sleep(DELAY);
		}
	}
	throw new NodeOperationError(this.getNode(), 'Timeout waiting for operations to finish');
}
