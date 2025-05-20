import type {
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { docspaceJsonApiRequest } from './GenericFunctions';

export class OnlyofficeTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ONLYOFFICE DocSpace Trigger',
		name: 'onlyofficeTrigger',
		icon: 'file:onlyoffice.svg',
		iconColor: 'orange',
		group: ['trigger'],
		description: 'Starts the workflow when ONLYOFFICE DocSpace events occur',
		version: [1],
		defaults: {
			name: 'ONLYOFFICE DocSpace Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],

		properties: [
			/* -------------------------------------------------------------------------- */
			/*                               authentication                               */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				default: 'apiKey',
				description: 'The authentication method to use',
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					},
					{
						name: 'Basic Auth',
						value: 'basicAuth',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
					{
						name: 'Personal Access Token',
						value: 'personalAccessToken',
					},
				],
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                                 properties                                 */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: 'Webhook from n8n',
				description: 'The name of the webhook to create',
				required: true,
			},
			{
				displayName: 'Serret Key',
				name: 'secretKey',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The secret key used to sign the webhook',
				required: true,
			},
			{
				displayName: 'Enabled',
				name: 'enabled',
				type: 'boolean',
				default: true,
				description: 'Whether the webhook is enabled',
			},
			{
				displayName: 'SSL',
				name: 'ssl',
				type: 'boolean',
				default: true,
				description: 'Whether to use SSL for the webhook',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: [0],
				description: 'The events to listen for',
				options: [
					{
						name: 'All',
						value: 0,
						description: 'All events',
					},
					{
						name: 'User Created',
						value: 1,
						description: 'A user was created',
					},
					{
						name: 'User Invited',
						value: 2,
						description: 'A user was invited',
					},
					{
						name: 'User Updated',
						value: 4,
						description: 'A user was updated',
					},
					{
						name: 'User Deleted',
						value: 8,
						description: 'A user was deleted',
					},
					{
						name: 'Group Created',
						value: 16,
						description: 'A group was created',
					},
					{
						name: 'Group Updated',
						value: 32,
						description: 'A group was updated',
					},
					{
						name: 'Group Deleted',
						value: 64,
						description: 'A group was deleted',
					},
					{
						name: 'File Created',
						value: 128,
						description: 'A file was created',
					},
					{
						name: 'File Uploaded',
						value: 256,
						description: 'A file was uploaded',
					},
					{
						name: 'File Updated',
						value: 512,
						description: 'A file was updated',
					},
					{
						name: 'File Trashed',
						value: 1024,
						description: 'A file was trashed',
					},
					{
						name: 'File Deleted',
						value: 2048,
						description: 'A file was deleted',
					},
					{
						name: 'File Restored',
						value: 4096,
						description: 'A file was restored',
					},
					{
						name: 'File Copied',
						value: 8192,
						description: 'A file was copied',
					},
					{
						name: 'File Moved',
						value: 16384,
						description: 'A file was moved',
					},
					{
						name: 'Folder Created',
						value: 32768,
						description: 'A folder was created',
					},
					{
						name: 'Folder Updated',
						value: 65536,
						description: 'A folder was updated',
					},
					{
						name: 'Folder Trashed',
						value: 131072,
						description: 'A folder was trashed',
					},
					{
						name: 'Folder Deleted',
						value: 262144,
						description: 'A folder was deleted',
					},
					{
						name: 'Folder Restored',
						value: 524288,
						description: 'A folder was restored',
					},
					{
						name: 'Folder Copied',
						value: 1048576,
						description: 'A folder was copied',
					},
					{
						name: 'Folder Moved',
						value: 2097152,
						description: 'A folder was moved',
					},
					{
						name: 'Room Created',
						value: 4194304,
						description: 'A room was created',
					},
					{
						name: 'Room Updated',
						value: 8388608,
						description: 'A room was updated',
					},
					{
						name: 'Room Archived',
						value: 16777216,
						description: 'A room was archived',
					},
					{
						name: 'Room Deleted',
						value: 33554432,
						description: 'A room was deleted',
					},
					{
						name: 'Room Restored',
						value: 67108864,
						description: 'A room was restored',
					},
					{
						name: 'Room Copied',
						value: 134217728,
						description: 'A room was copied',
					},
				],
			},
		],

		credentials: [
			{
				name: 'onlyofficeApiKeyApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['apiKey'],
					},
				},
			},
			{
				name: 'onlyofficeBasicAuthApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['basicAuth'],
					},
				},
			},
			{
				name: 'onlyofficeOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			},
			{
				name: 'onlyofficePersonalAccessTokenApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['personalAccessToken'],
					},
				},
			},
		],

		webhooks: [
			{
				name: 'setup',
				httpMethod: 'HEAD',
				responseMode: 'onReceived',
				path: 'webhook',
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const response = await docspaceJsonApiRequest.call(
					this,
					0,
					'GET',
					'api/2.0/settings/webhook',
				);
				for (const item of response.body.response) {
					if (item.configs.id === webhookData.webhookId) {
						return true;
					}
				}
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const name = this.getNodeParameter('name') as string;
				const enabled = this.getNodeParameter('enabled') as boolean;
				const secretKey = this.getNodeParameter('secretKey') as string;
				const ssl = this.getNodeParameter('ssl') as boolean;
				const events = this.getNodeParameter('events') as number[];
				const body: Record<string, unknown> = {
					name,
					uri: webhookUrl,
					secretKey,
					enabled,
					ssl,
				};
				if (events.length !== 0) {
					let sum = 0;
					for (const trigger of events) {
						if (trigger === 0) {
							sum = 0;
							break;
						}
						sum += trigger;
					}
					body.triggers = sum;
				}
				const response = await docspaceJsonApiRequest.call(
					this,
					0,
					'POST',
					'api/2.0/settings/webhook',
					undefined,
					body,
				);
				webhookData.webhookId = response.body.response.id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId) {
					await docspaceJsonApiRequest.call(
						this,
						0,
						'DELETE',
						`api/2.0/settings/webhook/${webhookData.webhookId}`,
					);
					delete webhookData.webhookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhookName = this.getWebhookName();
		if (webhookName === 'setup') {
			const res = this.getResponseObject();
			res.status(200).end();
			return {
				noWebhookResponse: true,
			};
		}
		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
