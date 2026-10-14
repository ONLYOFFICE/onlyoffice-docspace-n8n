import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeProperties,
	IWebhookFunctions,
} from 'n8n-workflow';

import { OnlyofficeDocspace } from '../../nodes/OnlyofficeDocspace/OnlyofficeDocspace.node';
import { OnlyofficeDocspaceTrigger } from '../../nodes/OnlyofficeDocspace/OnlyofficeDocspaceTrigger.node';

export const PORTAL = 'https://portal.example.com/';

/** An access token like the DocSpace OAuth server issues: its audience is the portal. */
export const ACCESS_TOKEN = ['{"alg":"none"}', `{"aud":"${PORTAL}"}`, 'signature']
	.map((part) => Buffer.from(part).toString('base64url'))
	.join('.');

export const WEBHOOK_URL = 'https://n8n.example.com/webhook/id/webhook';

const CREDENTIALS: Record<string, IDataObject> = {
	onlyofficeDocspaceApiKeyApi: { baseUrl: PORTAL, apiKey: 'key' },
	onlyofficeDocspaceBasicAuthApi: { baseUrl: PORTAL, email: 'user@example.com', password: 'pass' },
	onlyofficeDocspaceOAuth2Api: { oauthTokenData: { access_token: ACCESS_TOKEN } },
	onlyofficeDocspacePersonalAccessTokenApi: { baseUrl: PORTAL, personalAccessToken: 'token' },
};

export type Request = IHttpRequestOptions & {
	credentialsType: string;
	/** The item the credentials were read for. */
	itemIndex?: number;
	headers: IDataObject;
	qs?: IDataObject;
	body?: IDataObject & FormData;
};

/**
 * Fake portal: `"METHOD url"` maps to the `response` field of the API answer, or to a function
 * that gets the request and returns the full HTTP response. Other requests fail.
 */
export type Routes = Record<string, unknown>;

export const reply = (body: unknown, statusCode = 200, headers: IDataObject = {}) => ({
	statusCode,
	headers,
	body,
});

/** A request that n8n received on a webhook of the trigger. */
interface Delivery {
	webhookName: 'setup' | 'default';
	body?: IDataObject;
	headers?: IDataObject;
}

interface ContextOptions {
	params: IDataObject;
	routes?: Routes;
	items?: INodeExecutionData[];
	continueOnFail?: boolean;
	staticData?: IDataObject;
	delivery?: Delivery;
}

function isShown(property: INodeProperties, values: IDataObject) {
	const { show = {}, hide = {} } = property.displayOptions ?? {};
	return (
		Object.entries(show).every(([name, allowed]) => allowed?.includes(values[name] as string)) &&
		!Object.entries(hide).some(([name, hidden]) => hidden?.includes(values[name] as string))
	);
}

/**
 * Parameter values as n8n keeps them: the given ones plus the defaults of the displayed
 * properties. Hidden parameters have no value, so the node fails if it reads one.
 */
function resolveParameters(properties: INodeProperties[], params: IDataObject) {
	let values = params;
	// Repeat: defaults like isMyDocuments or binaryData change which properties are displayed.
	for (let pass = 0; pass < 3; pass++) {
		const next = { ...params };
		for (const property of properties) {
			if (!(property.name in next) && isShown(property, values)) {
				next[property.name] = property.default as string;
			}
		}
		values = next;
	}
	return values;
}

/**
 * A fake n8n context with the functions of every kind (execute, hook, load options, webhook), the
 * HTTP requests it sends and the response it gives on a webhook.
 */
function fakeContext(
	kind: 'execute' | 'hook',
	properties: INodeProperties[],
	options: ContextOptions,
) {
	const values = resolveParameters(properties, { authentication: 'basicAuth', ...options.params });
	const items: INodeExecutionData[] = options.items ?? [{ json: {} }];
	const requests: Request[] = [];
	let itemIndex: number | undefined;
	const response = { statusCode: 0, ended: false };
	const { webhookName = 'default', body = {}, headers = {} } = options.delivery ?? {};
	const context = {
		getInputData: () => items,
		getNode: () => ({
			name: 'ONLYOFFICE DocSpace',
			type: 'onlyofficeDocspace',
			parameters: values,
		}),
		continueOnFail: () => options.continueOnFail ?? false,
		getCredentials: async (type: string, index?: number) => {
			itemIndex = index;
			return CREDENTIALS[type];
		},
		// Execute functions take an item index first, hook functions do not.
		getNodeParameter: (name: string, ...rest: unknown[]) => {
			const [fallback, extract] = (kind === 'execute' ? rest.slice(1) : rest) as [
				unknown,
				{ extractValue?: boolean } | undefined,
			];
			if (!(name in values)) {
				if (fallback !== undefined) return fallback;
				throw new Error(`Could not get parameter "${name}"`);
			}
			const value = values[name] as IDataObject;
			// A resource locator keeps { mode, value }; tests may also give the bare value.
			return extract?.extractValue && typeof value === 'object' && 'mode' in value
				? value.value
				: value;
		},
		getWorkflowStaticData: () => options.staticData ?? {},
		getNodeWebhookUrl: () => WEBHOOK_URL,
		getWebhookName: () => webhookName,
		getBodyData: () => body,
		getHeaderData: () => headers,
		// The raw body is what DocSpace signs.
		getRequestObject: () => ({ headers, body, rawBody: Buffer.from(JSON.stringify(body)) }),
		getResponseObject: () => ({
			status(code: number) {
				response.statusCode = code;
				return this;
			},
			send() {
				response.ended = true;
				return this;
			},
			end() {
				response.ended = true;
				return this;
			},
		}),
		helpers: {
			httpRequestWithAuthentication: async (credentialsType: string, request: Request) => {
				requests.push({ ...request, credentialsType, itemIndex });
				const key = `${request.method} ${request.url}`;
				if (!(key in (options.routes ?? {}))) throw new Error(`Unexpected request ${key}`);
				const route = options.routes![key];
				return typeof route === 'function' ? route(request) : reply({ response: route });
			},
			returnJsonArray: (data: IDataObject | IDataObject[]) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (data: INodeExecutionData[], { itemData }: IDataObject) =>
				data.map((item) => ({ ...item, pairedItem: itemData })),
			assertBinaryData: (item: number, field: string) => items[item].binary![field],
			getBinaryDataBuffer: async (item: number, field: string) =>
				Buffer.from(items[item].binary![field].data, 'base64'),
			prepareBinaryData: async (buffer: Buffer, fileName: string, mimeType?: string) => ({
				data: Buffer.from(buffer).toString('base64'),
				fileName,
				mimeType,
			}),
		},
	};
	return { context, requests, response };
}

const node = new OnlyofficeDocspace();
const nodeProperties = node.description.properties;
const trigger = new OnlyofficeDocspaceTrigger();

/** Execute the node with a fake n8n context and return its output and HTTP requests. */
export async function runNode(options: ContextOptions) {
	const { context, requests } = fakeContext('execute', nodeProperties, options);
	const [output] = await node.execute.call(context as unknown as IExecuteFunctions);
	return { output, requests };
}

/** A context for the functions in GenericFunctions. */
export const genericContext = (options: ContextOptions) =>
	fakeContext('execute', nodeProperties, options);

/** Run a list search method of the node, as the editor does for a resource locator. */
export async function runListSearch(
	method: keyof OnlyofficeDocspace['methods']['listSearch'],
	options: ContextOptions,
	filter?: string,
) {
	// Load options functions read parameters without an item index, like hook functions.
	const { context, requests } = fakeContext('hook', nodeProperties, options);
	const { results } = await node.methods.listSearch[method].call(
		context as unknown as ILoadOptionsFunctions,
		filter,
	);
	return { results, requests };
}

/**
 * Run a webhook method of the trigger, as n8n does on activation (checkExists, create) and
 * deactivation (delete).
 */
export async function runHook(
	method: keyof (typeof trigger.webhookMethods)['default'],
	options: ContextOptions,
) {
	const { context, requests } = fakeContext('hook', trigger.description.properties, options);
	const result = await trigger.webhookMethods.default[method].call(
		context as unknown as IHookFunctions,
	);
	return { result, requests };
}

/** Deliver a request to a webhook of the trigger: what it gives n8n and how it answers itself. */
export async function runWebhook(delivery: Delivery, params: IDataObject = {}) {
	const { context, response } = fakeContext('hook', trigger.description.properties, {
		params,
		delivery,
	});
	const result = await trigger.webhook.call(context as unknown as IWebhookFunctions);
	return { result, response };
}

/** Requests as "METHOD url" lines, to compare call sequences. */
export const calls = (requests: Request[]) => requests.map((r) => `${r.method} ${r.url}`);

/** The request sent as "METHOD url". */
export const request = (requests: Request[], call: string) =>
	requests.find((r) => `${r.method} ${r.url}` === call)!;

/** A finished async file operation with `result`. */
export const finished = (result: IDataObject = {}, id = 'op') => [
	{ id, finished: true, ...result },
];
