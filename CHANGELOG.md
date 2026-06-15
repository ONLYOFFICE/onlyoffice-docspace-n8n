# Changelog

This document records all notable changes to the project, following the [Keep a
Changelog] format and adhering to [Semantic Versioning].

## [Unreleased]

### Fixed

- Wrap HTTP error in `NodeApiError`

## [1.0.0] - 2026-06-02

### Added

#### Nodes
- **ONLYOFFICE DocSpace** node for interacting with ONLYOFFICE DocSpace API
- **ONLYOFFICE DocSpace Trigger** node for webhook-based workflow automation

#### Authentication Methods
- API Key authentication
- Basic Auth authentication
- OAuth2 authentication
- Personal Access Token authentication

#### File Operations
- Copy a file
- Create a file (document, spreadsheet, presentation, PDF form)
- Delete a file
- Download a file with format conversion support
- Get file information
- Get file shared link
- Move a file
- Update a file
- Upload a file (binary and text content)

#### Folder Operations
- Copy a folder
- Create a folder
- Delete a folder
- Get folder contents with search support
- Get folder history with date filtering
- Get folder information
- Get folder shared link
- Move a folder
- Update a folder

#### Room Operations
- Archive a room
- Create a room
- Get room information
- Get room shared link
- Invite user to a room with role assignment
- Remove user from a room
- Search for rooms
- Search for users in a room
- Update a room
- Update user role in a room

#### User Operations
- Delete a user
- Disable a user
- Enable a user
- Get user information
- Invite a user
- Search for users
- Update a user

#### Trigger Events
- All Events
- User Created, Invited, Updated, Deleted
- Group Created, Updated, Deleted
- File Created, Uploaded, Updated, Trashed, Deleted, Restored, Copied, Moved
- Folder Created, Updated, Trashed, Deleted, Restored, Copied, Moved
- Room Created, Updated, Archived, Deleted, Restored, Copied

#### Documentation
- Comprehensive credentials setup guide
- Detailed operation documentation for all node types
- File operations guide
- Folder operations guide
- Room operations guide
- User operations guide
- Trigger node documentation

<!-- Definitions -->

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
[Semantic Versioning]: https://semver.org/spec/v2.0.0.html

<!-- Definitions: Tags -->

[Unreleased]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/compare/v1.0.0...HEAD/
[1.0.0]: https://github.com/onlyoffice/onlyoffice-docspace-n8n/releases/tag/v1.0.0

<!-- Definitions: Commits -->
