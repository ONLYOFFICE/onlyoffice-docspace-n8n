import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';

function docspaceResolveCredentialsType(authentication: string): string {
	switch (authentication) {
		case 'apiKey':
			return 'onlyofficeApiKeyApi';
		case 'basicAuth':
			return 'onlyofficeBasicAuthApi';
		case 'oAuth2':
			return 'onlyofficeOAuth2Api';
		case 'personalAccessToken':
			return 'onlyofficePersonalAccessTokenApi';
		default:
			throw new ApplicationError(`Unknown authentication ${authentication}`);
	}
}

export async function docspaceBufferApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	i: number,
	method: Exclude<IHttpRequestOptions['method'], undefined>,
	url: string,
): Promise<any> {
	const authentication = this.getNodeParameter('authentication', i) as string;
	const credentialsType = docspaceResolveCredentialsType(authentication);
	const credentials = await this.getCredentials(credentialsType, i);
	const baseUrl = credentials.baseUrl as string;
	const headers: IDataObject = {
		Accept: 'application/octet-stream',
		'User-Agent': 'n8n',
	};
	const requestOptions: IHttpRequestOptions = {
		url,
		baseURL: baseUrl,
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
	const credentialsType = docspaceResolveCredentialsType(authentication);
	const credentials = await this.getCredentials(credentialsType, i);
	const baseUrl = credentials.baseUrl as string;
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
	const credentialsType = docspaceResolveCredentialsType(authentication);
	const credentials = await this.getCredentials(credentialsType, i);
	const baseUrl = credentials.baseUrl as string;
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
		operations.push(...data.response);
	} else {
		operations.push(data.response);
	}
	if (operations.length === 0) {
		throw new ApplicationError('No input operations');
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
		throw new ApplicationError(`Errors in operations: ${errors}`);
	}
	if (finished === operations.length) {
		return { response: operations };
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
			throw new ApplicationError(`Errors in operations: ${errors}`);
		}
		if (finished === operations.length) {
			return operations;
		}
		if (attempt !== 19) {
			await new Promise((resolve) => setTimeout(resolve, DELAY));
		}
	}
	throw new ApplicationError('Timeout waiting for operations to finish');
}
