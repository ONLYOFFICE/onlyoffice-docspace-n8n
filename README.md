# ONLYOFFICE DocSpace n8n Nodes

[![npm version](https://img.shields.io/npm/v/@onlyoffice/n8n-nodes-docspace.svg)](https://www.npmjs.com/package/@onlyoffice/n8n-nodes-docspace)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/onlyoffice/onlyoffice-docspace-n8n/blob/master/LICENSE)

This is an n8n community node that lets you use [ONLYOFFICE DocSpace] in your n8n workflows.

ONLYOFFICE DocSpace is a room-based collaborative platform which allows organizing a clear file structure depending on users' needs or project goals.

[n8n] is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `@onlyoffice/n8n-nodes-docspace` in **Enter npm package name**
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes
5. Select **Install**

After installing the node, you can use it like any other node. n8n displays the node in search results in the **Nodes** panel.

### Manual Installation

To get started install the package in your n8n root directory:

```bash
npm install @onlyoffice/n8n-nodes-docspace
```

For Docker-based deployments add the following line before the font installation command in your [n8n Dockerfile]:

```dockerfile
RUN cd /usr/local/lib/node_modules/n8n && npm install @onlyoffice/n8n-nodes-docspace
```

## Nodes

This package provides the following nodes:

- **ONLYOFFICE DocSpace**: Interact with ONLYOFFICE DocSpace API
- **ONLYOFFICE DocSpace Trigger**: Trigger workflows on ONLYOFFICE DocSpace events

## Operations

The ONLYOFFICE DocSpace node supports the following operations:

### File Operations
- Copy a file
- Create a file
- Delete a file
- Download a file
- Get file info
- Get file shared link
- Move a file
- Update a file
- Upload a file

### Folder Operations
- Copy a folder
- Create a folder
- Delete a folder
- Get folder contents
- Get folder history
- Get folder info
- Get folder shared link
- Move a folder
- Update a folder

### Room Operations
- Archive a room
- Create a room
- Get room info
- Get room shared link
- Invite user to a room
- Remove user from a room
- Search for a room
- Search for a user in a room
- Update a room
- Update user in a room

### User Operations
- Delete a user
- Disable a user
- Enable a user
- Get a user
- Invite a user
- Search for a user
- Update a user

## Events

The ONLYOFFICE DocSpace Trigger node supports the following webhook events:

- All Events
- User Created
- User Invited
- User Updated
- User Deleted
- Group Created
- Group Updated
- Group Deleted
- File Created
- File Uploaded
- File Updated
- File Trashed
- File Deleted
- File Restored
- File Copied
- File Moved
- Folder Created
- Folder Updated
- Folder Trashed
- Folder Deleted
- Folder Restored
- Folder Copied
- Folder Moved
- Room Created
- Room Updated
- Room Archived
- Room Deleted
- Room Restored
- Room Copied

## Credentials

This node supports the following authentication methods:

- **API Key** (recommended)
- **Basic Auth**
- **OAuth2**
- **Personal Access Token**

Refer to [ONLYOFFICE DocSpace credentials documentation][Credentials] for detailed setup instructions.

## Documentation

Detailed documentation is available in the [docs/] directory:

- [Credentials Setup][Credentials]
- [ONLYOFFICE DocSpace Node Operations][App Node]
- [ONLYOFFICE DocSpace Trigger Node][Trigger Node]

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [ONLYOFFICE DocSpace API Documentation](https://api.onlyoffice.com/docspace/)
- [ONLYOFFICE DocSpace Help Center](https://helpcenter.onlyoffice.com/docspace/)

## Support

If you have any questions or need help, please:

- Open an issue on [GitHub](https://github.com/onlyoffice/onlyoffice-docspace-n8n/issues)
- Contact us at [support@onlyoffice.com](mailto:support@onlyoffice.com)

## License

The ONLYOFFICE DocSpace n8n Nodes are distributed under the MIT license. See [LICENSE] for more information.

## Version

See [CHANGELOG.md] for version history and release notes.

<!-- Definitions -->

[n8n]: https://n8n.io/
[ONLYOFFICE DocSpace]: https://www.onlyoffice.com/docspace.aspx
[n8n Dockerfile]: https://github.com/n8n-io/n8n/blob/master/docker/images/n8n/Dockerfile
[docs/]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/tree/master/docs/
[Credentials]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/tree/master/docs/credentials/
[App Node]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/tree/master/docs/app-node/
[Trigger Node]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/tree/master/docs/trigger-node/
[LICENSE]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/blob/master/LICENSE
[CHANGELOG.md]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/blob/master/CHANGELOG.md
