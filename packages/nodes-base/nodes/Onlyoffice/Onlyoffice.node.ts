import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import {
	docspaceBufferApiRequest,
	docspaceFormDataApiRequest,
	docspaceJsonApiRequest,
	docspaceResolveAsyncApiResponse,
} from './GenericFunctions';

type INodeExecutionOptions = Parameters<
	IExecuteFunctions['helpers']['constructExecutionMetaData']
>[1];

const roomInvitationAccessLevels: INodeListSearchItems[] = [
	{
		name: 'None',
		value: 0,
		description: 'No access to the room',
	},
	{
		name: 'Viewer',
		value: 2,
		description: 'File viewing',
	},
	{
		name: 'Reviewer',
		value: 5,
		description: 'Operations with existing files: viewing, reviewing, commenting',
	},
	{
		name: 'Commenter',
		value: 6,
		description: 'Operations with existing files: viewing, commenting',
	},
	{
		name: 'Form Filler',
		value: 7,
		description:
			'Form fillers can fill out forms and view only their completed/started forms within the Complete and In Process folders',
	},
	{
		name: 'Room Manager (Paid)',
		value: 9,
		description:
			'Room managers can manage the assigned rooms, invite new users and assign roles below their level',
	},
	{
		name: 'Editor',
		value: 10,
		description:
			'Operations with existing files: viewing, editing, form filling, reviewing, commenting',
	},
	{
		name: 'Content Creator',
		value: 11,
		description:
			"Content creators can create and edit files in the room, but can't manage users, or access settings",
	},
];

const formFillingRoomInvitationAccessLevels = [
	roomInvitationAccessLevels[4],
	roomInvitationAccessLevels[5],
	roomInvitationAccessLevels[7],
];

const collaborationRoomInvitationAccessLevels = [
	roomInvitationAccessLevels[1],
	roomInvitationAccessLevels[5],
	roomInvitationAccessLevels[6],
	roomInvitationAccessLevels[7],
];

const customRoomInvitationAccessLevels = [
	roomInvitationAccessLevels[1],
	roomInvitationAccessLevels[2],
	roomInvitationAccessLevels[3],
	roomInvitationAccessLevels[5],
	roomInvitationAccessLevels[6],
	roomInvitationAccessLevels[7],
];

const publicRoomInvitationAccessLevels = [
	roomInvitationAccessLevels[5],
	roomInvitationAccessLevels[7],
];

const virtualDataRoomInvitationAccessLevels = [
	roomInvitationAccessLevels[1],
	roomInvitationAccessLevels[4],
	roomInvitationAccessLevels[5],
	roomInvitationAccessLevels[6],
	roomInvitationAccessLevels[7],
];

const filtersProperty: INodeProperties = {
	displayName: 'Filters',
	name: 'filters',
	type: 'collection',
	default: {},
	options: [
		{
			displayName: 'Count',
			name: 'count',
			type: 'number',
			default: 0,
			description: 'The number of items to return',
		},
		{
			displayName: 'Start Index',
			name: 'startIndex',
			type: 'number',
			default: 0,
			description: 'The number of items to skip before starting to return items',
		},
		{
			displayName: 'Sort By',
			name: 'sortBy',
			type: 'string',
			default: '',
			description: 'The field to sort by',
			options: [
				{
					name: 'Author',
					value: 'Author',
				},
				{
					name: 'AZ',
					value: 'AZ',
				},
				{
					name: 'CustomOrder',
					value: 'CustomOrder',
				},
				{
					name: 'DateAndTime',
					value: 'DateAndTime',
				},
				{
					name: 'DateAndTimeCreation',
					value: 'DateAndTimeCreation',
				},
				{
					name: 'LastOpened',
					value: 'LastOpened',
				},
				{
					name: 'New',
					value: 'New',
				},
				{
					name: 'Room',
					value: 'Room',
				},
				{
					name: 'RoomType',
					value: 'RoomType',
				},
				{
					name: 'Size',
					value: 'Size',
				},
				{
					name: 'Tags',
					value: 'Tags',
				},
				{
					name: 'Type',
					value: 'Type',
				},
				{
					name: 'UsedSpace',
					value: 'UsedSpace',
				},
			],
		},
		{
			displayName: 'Sort Order',
			name: 'sortOrder',
			type: 'options',
			default: '',
			description: 'The order to sort by',
			options: [
				{
					name: 'Ascending',
					value: 'ascending',
				},
				{
					name: 'Descending',
					value: 'descending',
				},
			],
		},
		{
			displayName: 'Filter By',
			name: 'filterBy',
			type: 'string',
			default: '',
			description: 'The field to filter by',
		},
		{
			displayName: 'Filter Operation',
			name: 'filterOp',
			type: 'options',
			default: '',
			description: 'The operation to use for filtering',
			options: [
				{
					name: 'Contains',
					value: 'contains',
				},
				{
					name: 'Equals',
					value: 'equals',
				},
				{
					name: 'Starts With',
					value: 'startsWith',
				},
				{
					name: 'Present',
					value: 'present',
				},
			],
		},
		{
			displayName: 'Filter Value',
			name: 'filterValue',
			type: 'string',
			default: '',
			description: 'The value to filter by',
		},
		{
			displayName: 'Updated Since',
			name: 'updatedSince',
			type: 'dateTime',
			default: '',
			description: 'The date to filter items updated or created since',
		},
	],
};

export class Onlyoffice implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ONLYOFFICE DocSpace',
		name: 'onlyoffice',
		icon: 'file:onlyoffice.svg',
		iconColor: 'orange',
		group: ['input'],
		description: 'Consume ONLYOFFICE DocSpace API',
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		usableAsTool: true,
		version: [1],
		defaults: {
			name: 'ONLYOFFICE DocSpace',
		},
		inputs: [NodeConnectionTypes.Main],
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
			/*                                  resources                                 */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'file',
				options: [
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'File or Folder',
						value: 'fileOrFolder',
					},
					{
						name: 'Folder',
						value: 'folder',
					},
					{
						name: 'Room',
						value: 'room',
					},
					{
						name: 'User',
						value: 'user',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                               file:operations                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'createFile',
				displayOptions: {
					show: {
						resource: ['file'],
					},
				},
				options: [
					{
						name: 'Create File',
						value: 'createFile',
						action: 'Create a file',
					},
					{
						name: 'Delete File',
						value: 'deleteFile',
						action: 'Delete a file',
					},
					{
						name: 'Download File',
						value: 'downloadFile',
						action: 'Download a file',
					},
					{
						name: 'Get File Info',
						value: 'getFileInfo',
						action: 'Get file info',
					},
					{
						name: 'Get File Primary External Link',
						value: 'getFilePrimaryExternalLink',
						action: 'Get the primary external link of a file',
					},
					{
						name: 'Update File',
						value: 'updateFile',
						action: 'Update a file',
					},
					{
						name: 'Upload File',
						value: 'uploadFile',
						action: 'Upload a file',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                           fileOrFolder:operations                          */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'copyFileOrFolder',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
					},
				},
				options: [
					{
						name: 'Copy File or Folder',
						value: 'copyFileOrFolder',
						action: 'Copy a file or folder',
					},
					{
						name: 'Move File or Folder',
						value: 'moveFileOrFolder',
						action: 'Move a file or folder',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                              folder:operations                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'createFolder',
				displayOptions: {
					show: {
						resource: ['folder'],
					},
				},
				options: [
					{
						name: 'Create Folder',
						value: 'createFolder',
						action: 'Create a folder',
					},
					{
						name: 'Delete Folder',
						value: 'deleteFolder',
						action: 'Delete a folder',
					},
					{
						name: 'Get Folder',
						value: 'getFolder',
						action: 'Get a folder',
					},
					{
						name: 'Get Folder Info',
						value: 'getFolderInfo',
						action: 'Get folder info',
					},
					{
						name: 'Get Folder Primary External Link',
						value: 'getFolderPrimaryExternalLink',
						action: 'Get the primary external link of a folder',
					},
					{
						name: 'Get Folders',
						value: 'getFolders',
						action: 'Get folders',
					},
					{
						name: 'Update Folder',
						value: 'updateFolder',
						action: 'Update a folder',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                               room:operations                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'createRoom',
				displayOptions: {
					show: {
						resource: ['room'],
					},
				},
				options: [
					{
						name: 'Archive Room',
						value: 'archiveRoom',
						action: 'Archive a room',
					},
					{
						name: 'Create Room',
						value: 'createRoom',
						action: 'Create a room',
					},
					{
						name: 'Get Room Info',
						value: 'getRoomInfo',
						action: 'Get room info',
					},
					{
						name: 'Get Room Primary External Link',
						value: 'getRoomsPrimaryExternalLink',
						action: 'Get the primary external link of a room',
					},
					{
						name: 'Get Room Security Info',
						value: 'getRoomSecurityInfo',
						action: 'Get room security info',
					},
					{
						name: 'Get Rooms Folder',
						value: 'getRoomsFolder',
						action: 'Get rooms folder',
					},
					{
						name: 'Set Room Security',
						value: 'setRoomSecurity',
						action: 'Set room security',
					},
					{
						name: 'Update Room',
						value: 'updateRoom',
						action: 'Update a room',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                               user:operations                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'getUser',
				displayOptions: {
					show: {
						resource: ['user'],
					},
				},
				options: [
					{
						name: 'Delete User',
						value: 'deleteUser',
						action: 'Delete a user',
					},
					{
						name: 'Get User',
						value: 'getUser',
						action: 'Get a user',
					},
					{
						name: 'Invite User',
						value: 'inviteUser',
						action: 'Invite a user',
					},
					{
						name: 'Search User',
						value: 'searchUser',
						action: 'Search a user',
					},
					{
						name: 'Update User',
						value: 'updateUser',
						action: 'Update a user',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                               file:createFile                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'In My Documents',
				name: 'isMyDocuments',
				type: 'boolean',
				default: false,
				description: 'Whether to create the file in the "My documents" section',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['createFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to create the file in',
				displayOptions: {
					show: {
						isMyDocuments: [false],
						resource: ['file'],
						operation: ['createFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: 'File from n8n',
				description: 'The title of the file to create',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['createFile'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                               file:deleteFile                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the file to delete',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['deleteFile'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                              file:downloadFile                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the file to download',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['downloadFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'As Text',
				name: 'asText',
				type: 'boolean',
				default: false,
				description: 'Whether to download the file as text',
				hint: 'Download the file as ".csv" or ".txt", depending on the original format',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['downloadFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The format to download the file in',
				hint: 'Leave empty to use the original format of the file',
				displayOptions: {
					show: {
						asText: [false],
						resource: ['file'],
						operation: ['downloadFile'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a format...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listConvertible',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
					},
				],
			},
			{
				displayName: 'Put Output File in Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field to put the file in',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['downloadFile'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                              file:getFileInfo                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the file to get info for',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['getFileInfo'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       file:getFilePrimaryExternalLink                      */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the file to get the primary external link for',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['getFilePrimaryExternalLink'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                               file:updateFile                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the file to update',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['updateFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['updateFile'],
					},
				},
				options: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'The new title of the file to set',
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                               file:uploadFile                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'To My Documents',
				name: 'isMyDocuments',
				type: 'boolean',
				default: false,
				description: 'Whether to upload the file to the "My documents" section',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['uploadFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the room or folder to upload the file to',
				displayOptions: {
					show: {
						isMyDocuments: [false],
						resource: ['file'],
						operation: ['uploadFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'The file name with an extension to use for the uploaded file',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['uploadFile'],
					},
				},
			},
			{
				displayName: 'Binary File',
				name: 'binaryData',
				type: 'boolean',
				default: false,
				description: 'Whether the data to upload should be taken from binary field',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['uploadFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'File Content',
				name: 'fileContent',
				type: 'string',
				default: '',
				description: 'The text content of the file',
				displayOptions: {
					show: {
						binaryData: [false],
						resource: ['file'],
						operation: ['uploadFile'],
					},
				},
				required: true,
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the input binary field containing the file to be uploaded',
				displayOptions: {
					show: {
						binaryData: [true],
						resource: ['file'],
						operation: ['uploadFile'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                        fileOrFolder:copyFileOrFolder                       */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'File IDs',
				name: 'fileIds',
				type: 'number',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add File ID',
				},
				default: 0,
				description: 'The IDs of the files to copy',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
						operation: ['copyFileOrFolder'],
					},
				},
			},
			{
				displayName: 'Folder IDs',
				name: 'folderIds',
				type: 'number',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Folder ID',
				},
				default: 0,
				description: 'The IDs of the folders to copy',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
						operation: ['copyFileOrFolder'],
					},
				},
			},
			{
				displayName: 'To My Documents',
				name: 'isMyDocuments',
				type: 'boolean',
				default: false,
				description: 'Whether to copy the file or folder to the "My documents" section',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
						operation: ['copyFileOrFolder'],
					},
				},
				required: true,
			},
			{
				displayName: 'Destination ID',
				name: 'destFolderId',
				type: 'number',
				default: 0,
				description: 'The ID of the folder or room to copy to',
				displayOptions: {
					show: {
						isMyDocuments: [false],
						resource: ['fileOrFolder'],
						operation: ['copyFileOrFolder'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                        fileOrFolder:moveFileOrFolder                       */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'File IDs',
				name: 'fileIds',
				type: 'number',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add File ID',
				},
				default: 0,
				description: 'The IDs of the files to move',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
						operation: ['moveFileOrFolder'],
					},
				},
			},
			{
				displayName: 'Folder IDs',
				name: 'folderIds',
				type: 'number',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Folder ID',
				},
				default: 0,
				description: 'The IDs of the folders to move',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
						operation: ['moveFileOrFolder'],
					},
				},
			},
			{
				displayName: 'To My Documents',
				name: 'isMyDocuments',
				type: 'boolean',
				default: false,
				description: 'Whether to move the file or folder to the "My documents" section',
				displayOptions: {
					show: {
						resource: ['fileOrFolder'],
						operation: ['moveFileOrFolder'],
					},
				},
				required: true,
			},
			{
				displayName: 'Destination ID',
				name: 'destFolderId',
				type: 'number',
				default: 0,
				description: 'The ID of the folder or room to move to',
				displayOptions: {
					show: {
						isMyDocuments: [false],
						resource: ['fileOrFolder'],
						operation: ['moveFileOrFolder'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                             folder:createFolder                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'In My Documents',
				name: 'isMyDocuments',
				type: 'boolean',
				default: false,
				description: 'Whether to create the folder in the "My documents" section',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['createFolder'],
					},
				},
				required: true,
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the room or folder to create the folder in',
				displayOptions: {
					show: {
						isMyDocuments: [false],
						resource: ['folder'],
						operation: ['createFolder'],
					},
				},
				required: true,
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: 'Folder from n8n',
				description: 'The title of the folder to create',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['createFolder'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                             folder:deleteFolder                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to delete',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['deleteFolder'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                              folder:getFolder                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Is My Documents',
				name: 'isMyDocuments',
				type: 'boolean',
				default: false,
				description: 'Whether to get the "My documents" section',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['getFolder'],
					},
				},
				required: true,
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to get for',
				displayOptions: {
					show: {
						isMyDocuments: [false],
						resource: ['folder'],
						operation: ['getFolder'],
					},
				},
				required: true,
			},
			{
				...filtersProperty,
				description: 'The filters to apply to the contents of the folder',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['getFolder'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                            folder:getFolderInfo                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to get info for',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['getFolderInfo'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                     folder:getFolderPrimaryExternalLink                    */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to get the primary external link for',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['getFolderPrimaryExternalLink'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                              folder:getFolders                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to get subfolders for',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['getFolders'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                             folder:updateFolder                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'number',
				default: 0,
				description: 'The ID of the folder to update',
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['updateFolder'],
					},
				},
				required: true,
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['folder'],
						operation: ['updateFolder'],
					},
				},
				options: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'The new title of the folder to set',
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                              room:archiveRoom                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the room to archive',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['archiveRoom'],
					},
				},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a room...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listRooms',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '\\d+',
									errorMessage: 'The ID of the room must be a number',
								},
							},
						],
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                               room:createRoom                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: 'Room from n8n',
				description: 'The title of the room to create',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['createRoom'],
					},
				},
			},
			{
				displayName: 'Type',
				name: 'roomType',
				type: 'options',
				default: 6,
				description: 'The type of the room to create',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['createRoom'],
					},
				},
				options: [
					{
						name: 'Filling Forms Room',
						value: 1,
						description:
							'Upload PDF forms into the room. Invite members and guests to fill out a PDF form. Review completed forms and analyze data automatically collected in a spreadsheet.',
					},
					{
						name: 'Editing Room',
						value: 2,
						description: 'Collaborate on one or multiple documents with your team',
					},
					{
						name: 'Custom Room',
						value: 5,
						description: 'Apply your own settings to use this room for any custom purpose',
					},
					{
						name: 'Public Room',
						value: 6,
						description:
							'Share documents for viewing, editing, commenting, or reviewing without registration. You can also embed this room into any web interface.',
					},
					{
						name: 'Virtual Data Room',
						value: 8,
						description:
							'Use VDR for advanced file security and transparency. Set watermarks, automatically index and track all content, restrict downloading and copying.',
					},
				],
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                              room:getRoomInfo                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the room to get info for',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['getRoomInfo'],
					},
				},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a room...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listRooms',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '\\d+',
									errorMessage: 'The ID of the room must be a number',
								},
							},
						],
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                      room:getRoomsPrimaryExternalLink                      */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the room to get the primary external link for',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['getRoomsPrimaryExternalLink'],
					},
				},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a room...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listRooms',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '\\d+',
									errorMessage: 'The ID of the room must be a number',
								},
							},
						],
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                          room:getRoomSecurityInfo                          */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the room to get security info for',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['getRoomSecurityInfo'],
					},
				},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a room...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listRooms',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '\\d+',
									errorMessage: 'The ID of the room must be a number',
								},
							},
						],
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                            room:setRoomSecurity                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the room to invite or remove users from',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['setRoomSecurity'],
					},
				},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a room...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listRooms',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '\\d+',
									errorMessage: 'The ID of the room must be a number',
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Invitations',
				name: 'invitations',
				type: 'collection',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Invitation',
				},
				default: {},
				description: 'The invitations or removals to perform. Must contain either ID or Email.',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['setRoomSecurity'],
					},
				},
				options: [
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'The ID of the user to invite or remove. Mutually exclusive with Email.',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						default: '',
						description: 'The email of the user to invite or remove. Mutually exclusive with ID.',
						placeholder: 'name@email.com',
					},
					{
						displayName: 'Access',
						name: 'access',
						type: 'resourceLocator',
						default: {
							mode: 'list',
							value: '',
						},
						description:
							'The access level to grant to the user. May vary depending on the type of room.',
						modes: [
							{
								displayName: 'From List',
								name: 'list',
								type: 'list',
								placeholder: 'Select an access level...',
								typeOptions: {
									searchable: true,
									searchListMethod: 'listAccessLevels',
								},
							},
							{
								displayName: 'Manual',
								name: 'manual',
								type: 'string',
							},
						],
					},
				],
			},
			{
				displayName: 'Notify',
				name: 'notify',
				type: 'boolean',
				default: true,
				description: 'Whether to notify the user',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['setRoomSecurity'],
					},
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				description: 'The message to use for the invitation',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['setRoomSecurity'],
					},
				},
			},
			{
				displayName: 'Culture',
				name: 'culture',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The languages to use for the invitation',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['setRoomSecurity'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a culture...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listCultures',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                               room:updateRoom                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the room to update',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['updateRoom'],
					},
				},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a room...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listRooms',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '\\d+',
									errorMessage: 'The ID of the room must be a number',
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The new title of the room to set',
				displayOptions: {
					show: {
						resource: ['room'],
						operation: ['updateRoom'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                               user:deleteUser                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the user to delete',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['deleteUser'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listUsers',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
					},
				],
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                                 user:getUser                               */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Is Me',
				name: 'isMe',
				type: 'boolean',
				default: false,
				description: 'Whether to get the current authenticated user',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['getUser'],
					},
				},
				required: true,
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the user to get for',
				displayOptions: {
					show: {
						isMe: [false],
						resource: ['user'],
						operation: ['getUser'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listUsers',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
					},
				],
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				description: 'The email of the user to get for',
				placeholder: 'name@email.com',
				displayOptions: {
					show: {
						isMe: [false],
						resource: ['user'],
						operation: ['getUser'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                               user:inviteUser                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Invitations',
				name: 'invitations',
				type: 'collection',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Invitation',
				},
				default: {},
				description: 'The invitations to perform',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['inviteUser'],
					},
				},
				options: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						default: 4,
						description: 'The type of the user to invite',
						options: [
							{
								name: 'Room Admin',
								value: 1,
							},
							{
								name: 'DocSpace Admin',
								value: 3,
							},
							{
								name: 'User',
								value: 4,
							},
						],
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						default: '',
						description: 'The email of the user to invite',
						placeholder: 'name@email.com',
					},
				],
				required: true,
			},
			{
				displayName: 'Culture',
				name: 'culture',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The languages to use for the invitation',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['inviteUser'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a culture...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listCultures',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                               user:searchUser                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'The query to search for',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['searchUser'],
					},
				},
			},
			{
				...filtersProperty,
				description: 'The filters to apply to the search',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['searchUser'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                               user:updateUser                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'ID',
				name: 'id',
				type: 'resourceLocator',
				default: {
					mode: 'list',
					value: '',
				},
				description: 'The ID of the user to update',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['updateUser'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchable: true,
							searchListMethod: 'listUsers',
						},
					},
					{
						displayName: 'Manual',
						name: 'manual',
						type: 'string',
					},
				],
				required: true,
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['updateUser'],
					},
				},
				options: [
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						default: 1,
						description: 'The status to set for the user',
						options: [
							{
								name: 'Enable',
								value: 1,
							},
							{
								name: 'Disable',
								value: 2,
							},
						],
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						default: 2,
						description: 'The type to set for the user',
						options: [
							{
								name: 'Room Admin',
								value: 1,
							},
							{
								name: 'Guest',
								value: 2,
							},
							{
								name: 'DocSpace Admin',
								value: 3,
							},
							{
								name: 'User',
								value: 4,
							},
						],
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
	};

	methods = {
		listSearch: {
			async listAccessLevels(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L165
				const results: INodeListSearchItems[] = [];
				const levels: INodeListSearchItems[] = [];
				const id = this.getNodeParameter('id', '', { extractValue: true }) as string;
				if (id) {
					const response = await docspaceJsonApiRequest.call(
						this,
						0,
						'GET',
						`api/2.0/files/rooms/${id}`,
					);
					switch (response.body.response.roomType) {
						case 1:
							levels.push(...formFillingRoomInvitationAccessLevels);
							break;
						case 2:
							levels.push(...collaborationRoomInvitationAccessLevels);
							break;
						case 5:
							levels.push(...customRoomInvitationAccessLevels);
							break;
						case 6:
							levels.push(...publicRoomInvitationAccessLevels);
							break;
						case 8:
							levels.push(...virtualDataRoomInvitationAccessLevels);
							break;
					}
				}
				if (levels.length === 0) {
					levels.push(...roomInvitationAccessLevels);
				}
				if (filter) {
					for (const level of levels) {
						if (level.name.toLowerCase().includes(filter.toLowerCase())) {
							results.push(level);
						}
					}
				} else {
					results.push(...levels);
				}
				const result: INodeListSearchResult = {
					results,
				};
				return result;
			},

			async listConvertible(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/SettingsController.cs#L199
				const results: INodeListSearchItems[] = [];
				const id = this.getNodeParameter('id', 0) as number;
				if (!id) {
					throw new NodeOperationError(
						this.getNode(),
						'The ID of the file to get convertible formats for is required',
					);
				}
				const infoResponse = await docspaceJsonApiRequest.call(
					this,
					0,
					'GET',
					`api/2.0/files/file/${id}`,
				);
				const settingsResponse = await docspaceJsonApiRequest.call(
					this,
					0,
					'GET',
					'api/2.0/files/settings',
				);
				for (const item of settingsResponse.body.response.extsConvertible[
					infoResponse.body.response.fileExst
				]) {
					if (!filter || (filter && item.toLowerCase().includes(filter.toLowerCase()))) {
						const options: INodeListSearchItems = {
							name: item,
							value: item,
						};
						results.push(options);
					}
				}
				const result: INodeListSearchResult = {
					results,
				};
				return result;
			},

			async listCultures(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/web/ASC.Web.Api/Api/Settings/SettingsController.cs/#L476
				const results: INodeListSearchItems[] = [];
				const response = await docspaceJsonApiRequest.call(
					this,
					0,
					'GET',
					'api/2.0/settings/cultures',
				);
				for (const item of response.body.response) {
					if (!filter || (filter && item.toLowerCase().includes(filter.toLowerCase()))) {
						const options: INodeListSearchItems = {
							name: item,
							value: item,
						};
						results.push(options);
					}
				}
				const result: INodeListSearchResult = {
					results,
				};
				return result;
			},

			async listRooms(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L649
				const results: INodeListSearchItems[] = [];
				const filters: {
					filterValue?: string;
				} = {};
				if (filter) {
					filters.filterValue = filter;
				}
				const response = await docspaceJsonApiRequest.call(
					this,
					0,
					'GET',
					'api/2.0/files/rooms',
					filters,
				);
				for (const folder of response.body.response.folders) {
					const options: INodeListSearchItems = {
						name: folder.title,
						value: folder.id,
					};
					results.push(options);
				}
				const result: INodeListSearchResult = {
					results,
				};
				return result;
			},

			async listUsers(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L681
				// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L880
				const results: INodeListSearchItems[] = [];
				let response;
				if (filter) {
					response = await docspaceJsonApiRequest.call(
						this,
						0,
						'GET',
						`api/2.0/people/@search/${encodeURIComponent(filter)}`,
					);
				} else {
					response = await docspaceJsonApiRequest.call(this, 0, 'GET', 'api/2.0/people');
				}
				for (const user of response.body.response) {
					const options: INodeListSearchItems = {
						name: user.displayName,
						value: user.id,
					};
					results.push(options);
				}
				const result: INodeListSearchResult = {
					results,
				};
				return result;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			let resultDataObject: IDataObject | undefined;
			let resultBinaryData: IBinaryData | undefined;

			try {
				const resource = this.getNodeParameter('resource', i);
				const operation = this.getNodeParameter('operation', i);

				switch (resource) {
					case 'file': {
						switch (operation) {
							case 'createFile': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L198
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L551
								let id: number | string | undefined;
								const isMyDocuments = this.getNodeParameter('isMyDocuments', i) as boolean;
								if (isMyDocuments) {
									id = '@my';
								} else {
									id = this.getNodeParameter('id', i) as number;
								}
								const title = this.getNodeParameter('title', i) as string;
								const body = {
									title,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'POST',
									`api/2.0/files/${id}/file`,
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'deleteFile': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L305
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L239
								const id = this.getNodeParameter('id', i) as number;
								const infoResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${id}`,
								);
								const deleteBody = {
									deleteAfter: false,
									immediately: false,
								};
								const deleteResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'DELETE',
									`api/2.0/files/file/${id}`,
									undefined,
									deleteBody,
								);
								await docspaceResolveAsyncApiResponse.call(this, i, deleteResponse.body);
								resultDataObject = infoResponse.body;
								break;
							}

							case 'downloadFile': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L305
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/OperationController.cs/#L51
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/SettingsController.cs#L199
								const id = this.getNodeParameter('id', i) as number;
								const asText = this.getNodeParameter('asText', i) as boolean;
								const infoResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${id}`,
								);
								resultDataObject = infoResponse.body;
								let extension: string | undefined;
								if (asText) {
									const settingsResponse = await docspaceJsonApiRequest.call(
										this,
										i,
										'GET',
										'api/2.0/files/settings',
									);
									for (const item of settingsResponse.body.response.extsConvertible[
										infoResponse.body.response.fileExst
									]) {
										if (item === '.csv' || item === '.txt') {
											extension = item;
											break;
										}
									}
									if (!extension) {
										throw new NodeOperationError(
											this.getNode(),
											'File could not be converted to text',
											{ itemIndex: i },
										);
									}
								} else {
									const outputFormat = this.getNodeParameter('outputFormat', i, '', {
										extractValue: true,
									}) as string;
									if (outputFormat) {
										extension = outputFormat;
									}
								}
								let downloadBody;
								if (extension) {
									downloadBody = {
										fileConvertIds: [{ key: id, value: extension }],
									};
								} else {
									downloadBody = {
										fileIds: [id],
									};
								}
								const downloadResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									'api/2.0/files/fileops/bulkdownload',
									undefined,
									downloadBody,
								);
								const resolved = await docspaceResolveAsyncApiResponse.call(
									this,
									i,
									downloadResponse.body,
								);
								const bufferResponse = await docspaceBufferApiRequest.call(
									this,
									i,
									'GET',
									resolved[0].url,
								);
								let filePath: string | undefined;
								if (extension) {
									const fileName = infoResponse.body.response.title.slice(
										0,
										-infoResponse.body.response.fileExst.length,
									);
									filePath = `${fileName}${extension}`;
								} else {
									filePath = infoResponse.body.response.title;
								}
								resultBinaryData = await this.helpers.prepareBinaryData(
									bufferResponse.body,
									filePath,
									bufferResponse.headers['Content-Type'],
								);
								break;
							}

							case 'getFileInfo': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L305
								const id = this.getNodeParameter('id', i) as number;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${id}`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getFilePrimaryExternalLink': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L445
								const id = this.getNodeParameter('id', i) as number;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${id}/link`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'updateFile': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L399
								const id = this.getNodeParameter('id', i) as number;
								const fields = this.getNodeParameter('fields', i) as {
									title?: string;
								};
								const body = {
									title: fields.title,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									`api/2.0/files/file/${id}`,
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'uploadFile': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L305
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/UploadController.cs/#L76
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Startup.cs/#L76
								const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10mb
								let id: number | string | undefined;
								const isMyDocuments = this.getNodeParameter('isMyDocuments', i) as boolean;
								if (isMyDocuments) {
									id = '@my';
								} else {
									id = this.getNodeParameter('id', i) as number;
								}
								const sessionBody = {
									fileName: '',
									fileSize: 0,
									createOn: new Date().toISOString(),
								};
								let mimeType = '';
								let buffer: Uint8Array | undefined;
								const isBinaryData = this.getNodeParameter('binaryData', i);
								if (isBinaryData) {
									const fileName = this.getNodeParameter('fileName', i) as string;
									const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i);
									const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
									const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(
										i,
										binaryPropertyName,
									);
									if (fileName) {
										sessionBody.fileName = fileName;
									} else if (binaryData.fileName) {
										sessionBody.fileName = binaryData.fileName;
									}
									mimeType = binaryData.mimeType;
									buffer = binaryDataBuffer;
								} else {
									const fileName = this.getNodeParameter('fileName', i) as string;
									const fileContent = this.getNodeParameter('fileContent', i) as string;
									sessionBody.fileName = fileName;
									mimeType = 'text/plain';
									buffer = new TextEncoder().encode(fileContent);
								}
								if (!sessionBody.fileName) {
									throw new NodeOperationError(this.getNode(), 'File name is not set', {
										itemIndex: i,
									});
								}
								sessionBody.fileSize = buffer.length;
								const sessionResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'POST',
									`api/2.0/files/${id}/upload/create_session`,
									undefined,
									sessionBody,
								);
								let uploadResponse;
								let done = false;
								const chunks = Math.ceil(buffer.length / MAX_CHUNK_SIZE);
								for (let index = 0; index < chunks; index += 1) {
									const start = index * MAX_CHUNK_SIZE;
									const end = (index + 1) * MAX_CHUNK_SIZE;
									const chunk = buffer.slice(start, end);
									const blob = new Blob([chunk], { type: mimeType });
									const formData = new FormData();
									formData.append('file', blob, sessionBody.fileName);
									uploadResponse = await docspaceFormDataApiRequest.call(
										this,
										index,
										`ChunkedUploader.ashx?uid=${sessionResponse.body.response.data.id}`,
										formData,
									);
									if (uploadResponse.statusCode === 201) {
										done = true;
									}
									if (done) {
										break;
									}
								}
								if (!done) {
									throw new NodeOperationError(this.getNode(), 'Upload session not completed', {
										itemIndex: i,
									});
								}
								const infoResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${uploadResponse.body.data.id}`,
								);
								resultDataObject = infoResponse.body;
								break;
							}

							default: {
								break;
							}
						}
					}

					case 'folder': {
						switch (operation) {
							case 'createFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L110
								let id: number | string | undefined;
								const isMyDocuments = this.getNodeParameter('isMyDocuments', i) as boolean;
								if (isMyDocuments) {
									id = '@my';
								} else {
									id = this.getNodeParameter('id', i) as number;
								}
								const title = this.getNodeParameter('title', i) as string;
								const body = {
									title,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'POST',
									`api/2.0/files/${id}/folder`,
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'deleteFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L305
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L126
								const id = this.getNodeParameter('id', i) as number;
								const infoResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${id}`,
								);
								const deleteBody = {
									deleteAfter: false,
									immediately: false,
								};
								const deleteResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'DELETE',
									`api/2.0/files/folder/${id}`,
									undefined,
									deleteBody,
								);
								await docspaceResolveAsyncApiResponse.call(this, i, deleteResponse.body);
								resultDataObject = infoResponse.body;
								break;
							}

							case 'getFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L161
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L348
								let id: number | string | undefined;
								const isMyDocuments = this.getNodeParameter('isMyDocuments', i) as boolean;
								if (isMyDocuments) {
									id = '@my';
								} else {
									id = this.getNodeParameter('id', i) as number;
								}
								const filters = this.getNodeParameter('filters', i);
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/${id}`,
									filters,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getFolderInfo': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L180
								const id = this.getNodeParameter('id', i) as number;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/folder/${id}`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getFolderPrimaryExternalLink': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L287
								const id = this.getNodeParameter('id', i) as number;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/folder/${id}/link`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getFolders': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L217
								const id = this.getNodeParameter('id', i) as number;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/${id}/subfolders`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'updateFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FoldersController.cs/#L255
								const id = this.getNodeParameter('id', i) as number;
								const fields = this.getNodeParameter('fields', i) as {
									title?: string;
								};
								const body = {
									title: fields.title,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									`api/2.0/files/folder/${id}`,
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							default: {
								break;
							}
						}
					}

					case 'fileOrFolder': {
						switch (operation) {
							case 'copyFileOrFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/OperationController.cs/#L74
								const fileIds = this.getNodeParameter('fileIds', i) as number[];
								const folderIds = this.getNodeParameter('folderIds', i) as number[];
								let destFolderId: string | number | undefined;
								const isMyDocuments = this.getNodeParameter('isMyDocuments', i) as boolean;
								if (isMyDocuments) {
									destFolderId = '@my';
								} else {
									destFolderId = this.getNodeParameter('destFolderId', i) as number;
								}
								const body = {
									fileIds,
									folderIds,
									destFolderId,
									deleteAfter: false,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									'api/2.0/files/fileops/copy',
									undefined,
									body,
								);
								const resolved = await docspaceResolveAsyncApiResponse.call(this, i, response.body);
								resultDataObject = resolved;
								break;
							}

							case 'moveFileOrFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/OperationController.cs/#L173
								const fileIds = this.getNodeParameter('fileIds', i) as number[];
								const folderIds = this.getNodeParameter('folderIds', i) as number[];
								let destFolderId: string | number | undefined;
								const isMydDocuments = this.getNodeParameter('isMyDocuments', i) as boolean;
								if (isMydDocuments) {
									destFolderId = '@my';
								} else {
									destFolderId = this.getNodeParameter('destFolderId', i) as number;
								}
								const body = {
									fileIds,
									folderIds,
									destFolderId,
									deleteAfter: false,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									'api/2.0/files/fileops/move',
									undefined,
									body,
								);
								const resolved = await docspaceResolveAsyncApiResponse.call(this, i, response.body);
								resultDataObject = resolved;
								break;
							}

							default: {
								break;
							}
						}
					}

					case 'room': {
						switch (operation) {
							case 'archiveRoom': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/FilesController.cs/#L305
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L275
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const infoResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/file/${id}`,
								);
								const archiveBody = {
									deleteAfter: false,
								};
								const archiveResponse = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									`api/2.0/files/rooms/${id}/archive`,
									undefined,
									archiveBody,
								);
								await docspaceResolveAsyncApiResponse.call(this, i, archiveResponse.body);
								resultDataObject = infoResponse.body;
								break;
							}

							case 'createRoom': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L70
								const title = this.getNodeParameter('title', i) as string;
								const roomType = this.getNodeParameter('roomType', i) as number;
								const body = {
									title,
									roomType,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'POST',
									'api/2.0/files/rooms',
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getRoomInfo': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L165
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/rooms/${id}`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getRoomsPrimaryExternalLink': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L424
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/rooms/${id}/link`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getRoomSecurityInfo': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L349
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/files/rooms/${id}/share`,
								);
								resultDataObject = response.body;
								break;
							}

							case 'getRoomsFolder': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L649
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									'api/2.0/files/rooms',
								);
								resultDataObject = response.body;
								break;
							}

							case 'setRoomSecurity': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L311
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const invitations = this.getNodeParameter('invitations', i) as IDataObject[];
								const notify = this.getNodeParameter('notify', i) as boolean;
								const message = this.getNodeParameter('message', i) as string;
								const culture = this.getNodeParameter('culture', i, '', {
									extractValue: true,
								}) as string;
								const body = {
									invitations,
									notify,
									message,
									culture,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									`api/2.0/files/rooms/${id}/share`,
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'updateRoom': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.Files/Server/Api/VirtualRoomsController.cs/#L180
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const title = this.getNodeParameter('title', i) as string;
								const body = {
									title,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									`api/2.0/files/rooms/${id}`,
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							default: {
								break;
							}
						}
					}

					case 'user': {
						switch (operation) {
							case 'getUser': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.1.0-server/products/ASC.People/Server/Api/UserController.cs/#L847
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.1.0-server/products/ASC.People/Server/Api/UserController.cs/#L890
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.1.0-server/products/ASC.People/Server/Api/UserController.cs/#L1355
								const isMe = this.getNodeParameter('isMe', i) as boolean;
								let response;
								if (isMe) {
									response = await docspaceJsonApiRequest.call(
										this,
										i,
										'GET',
										'api/2.0/people/@self',
									);
								} else {
									const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
									const email = this.getNodeParameter('email', i) as string;
									if (id && email) {
										throw new NodeOperationError(
											this.getNode(),
											'Must provide either id or email, not both',
											{ itemIndex: i },
										);
									}
									if (id) {
										response = await docspaceJsonApiRequest.call(
											this,
											i,
											'GET',
											`api/2.0/people/${id}`,
										);
									} else if (email) {
										const query = {
											email,
										};
										response = await docspaceJsonApiRequest.call(
											this,
											i,
											'GET',
											'api/2.0/people/email',
											query,
										);
									}
								}
								resultDataObject = response.body;
								break;
							}

							case 'deleteUser': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L947
								const id = this.getNodeParameter('id', i) as string;
								const body = {
									userIds: [id],
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'PUT',
									'api/2.0/people/delete',
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'inviteUser': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L325
								const invitations = this.getNodeParameter('invitations', i) as IDataObject[];
								const culture = this.getNodeParameter('culture', i, '', {
									extractValue: true,
								}) as string;
								const body = {
									invitations,
									culture,
								};
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'POST',
									'api/2.0/people/invite',
									undefined,
									body,
								);
								resultDataObject = response.body;
								break;
							}

							case 'searchUser': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L681
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L880
								const query = this.getNodeParameter('query', i) as string;
								const filters = this.getNodeParameter('filters', i);
								let response;
								if (query) {
									response = await docspaceJsonApiRequest.call(
										this,
										i,
										'GET',
										`api/2.0/people/@search/${encodeURIComponent(query)}`,
										filters,
									);
								} else {
									response = await docspaceJsonApiRequest.call(
										this,
										i,
										'GET',
										'api/2.0/people',
										filters,
									);
								}
								resultDataObject = response.body;
								break;
							}

							case 'updateUser': {
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.1.0-server/products/ASC.People/Server/Api/UserController.cs/#L890
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.0.4-server/products/ASC.People/Server/Api/UserController.cs/#L1576
								// https://github.com/ONLYOFFICE/DocSpace-server/blob/v3.1.0-server/products/ASC.People/Server/Api/UserController.cs/#L1941
								const id = this.getNodeParameter('id', i, '', { extractValue: true }) as string;
								const fields = this.getNodeParameter('fields', i) as {
									status?: number;
									type?: number;
								};
								if (fields.status) {
									const body = {
										userIds: [id],
									};
									await docspaceJsonApiRequest.call(
										this,
										i,
										'PUT',
										`api/2.0/people/status/${fields.status}`,
										undefined,
										body,
									);
								}
								if (fields.type) {
									const body = {
										type: fields.type,
										userId: id,
									};
									await docspaceJsonApiRequest.call(
										this,
										i,
										'POST',
										'api/2.0/people/type',
										undefined,
										body,
									);
									// todo: sync
								}
								const response = await docspaceJsonApiRequest.call(
									this,
									i,
									'GET',
									`api/2.0/people/${id}`,
								);
								resultDataObject = response.body;
								break;
							}

							default: {
								break;
							}
						}
					}
				}

				if (resultDataObject === undefined && resultBinaryData === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						`The operation ${operation} is not recognized for the resource ${resource}`,
						{ itemIndex: i },
					);
				}

				if (resultDataObject === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'The result of an operation cannot be undefined',
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					resultDataObject = {
						error: error.message,
					};
				} else {
					throw error;
				}
			}

			if (resultBinaryData) {
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i);
				const newItem: INodeExecutionData = {
					json: items[i].json,
					binary: {},
					pairedItem: items[i].pairedItem,
				};
				if (Object.keys(newItem.json).length === 0) {
					newItem.json = resultDataObject;
				}
				if (items[i].binary !== undefined && newItem.binary) {
					// Create a shallow copy of the binary data so that the old
					// data references which do not get changed still stay behind
					// but the incoming data does not get changed.
					Object.assign(newItem.binary, items[i].binary);
				}
				if (newItem.binary) {
					newItem.binary[binaryPropertyName] = resultBinaryData;
				}
				returnData.push(newItem);
			} else {
				const executionData = this.helpers.returnJsonArray(resultDataObject);
				const executionOptions: INodeExecutionOptions = {
					itemData: {
						item: i,
					},
				};
				const executionMetaData = this.helpers.constructExecutionMetaData(
					executionData,
					executionOptions,
				);
				returnData.push(...executionMetaData);
			}
		}

		return [returnData];
	}
}
