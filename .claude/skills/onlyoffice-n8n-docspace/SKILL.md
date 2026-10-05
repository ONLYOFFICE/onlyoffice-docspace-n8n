---
name: onlyoffice-n8n-docspace
description:
  The ONLYOFFICE DocSpace n8n package (@onlyoffice/n8n-nodes-docspace) - repo map, the four
  credential types and base URL resolution, request helpers, async file operations, execute/output conventions,
  resource locators, the webhook trigger and task workflows. Use at the start of every task in this repo
  together with onlyoffice-n8n-docspace-development.
---

# ONLYOFFICE DocSpace n8n nodes

Two nodes — `ONLYOFFICE DocSpace` (`onlyofficeDocspace`: resources File / Folder / Room / User, 35 operations) and
`ONLYOFFICE DocSpace Trigger` (`onlyofficeDocspaceTrigger`, webhooks) — and four credentials. API calls are annotated with links to DocSpace-server sources at `v3.0.4-server`; keep adding such a link above every new
call — it is the only API reference in the code.

## Repo map

| Path                                                       | What                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `nodes/OnlyofficeDocspace/OnlyofficeDocspace.node.ts`      | ~4400 lines: access-level tables, description (banner per `resource:operation`), `methods.listSearch`, `execute` (nested `switch (resource)` → `switch (operation)`) |
| `nodes/OnlyofficeDocspace/GenericFunctions.ts`             | Credential type / base URL resolution, JSON / buffer / form-data requests, async-operation polling |
| `nodes/OnlyofficeDocspace/OnlyofficeDocspaceTrigger.node.ts` | Webhook registration and receiver                                                     |
| `credentials/*.credentials.ts`                             | API Key, Basic Auth, OAuth2, Personal Access Token                                      |
| `test/`                                                     | Unit and automation tests, see onlyoffice-n8n-docspace-development |
| `docs/`                                                    | User docs: `credentials/`, `app-node/<resource>-operations.md`, `trigger-node/`; linked from credential `documentationUrl` and the codex `*.node.json` (GitHub `master` URLs) |

## Authentication

Parameter `authentication` (`apiKey` default, `basicAuth`, `oAuth2`, `personalAccessToken`) selects the credential via
`displayOptions`; `docspaceResolveCredentialsType` maps it to the credential name.

| Credential                                  | Auth (`authenticate`)                           | Base URL                                  |
| ------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `onlyofficeDocspaceApiKeyApi`               | `Authorization: Bearer <apiKey>`                | `baseUrl`                                 |
| `onlyofficeDocspaceBasicAuthApi`            | HTTP basic (`email`, `password`)                | `baseUrl`                                 |
| `onlyofficeDocspaceOAuth2Api`               | `extends: ['oAuth2Api']`, fixed scopes, `authBaseUrl` default `https://oauth.onlyoffice.com` | `aud` claim of the access-token JWT |
| `onlyofficeDocspacePersonalAccessTokenApi`  | `Authorization: <token>` (no `Bearer`)          | `baseUrl`                                 |

Credential tests: `GET api/2.0/authentication` with rule `response === false` → error. OAuth2 has no test. Adding a
scope-dependent feature → check the OAuth2 `scopes` list (the trigger does not offer OAuth2: the OAuth server does not
issue webhook scopes).

## Requests (`GenericFunctions.ts`)

- `docspaceJsonApiRequest.call(this, i, method, 'api/2.0/...', qs?, body?)` — relative URL + `baseURL`,
  `httpRequestWithAuthentication`, `returnFullResponse: true` → read **`response.body.response`**.
- `docspaceBufferApiRequest(i, method, absoluteUrl)` — arraybuffer download (`resolved[0].url` of bulk download).
- `docspaceFormDataApiRequest(i, url, FormData)` — chunk upload to `ChunkedUploader.ashx?uid=<session>`.
- `docspaceResolveAsyncApiResponse(i, body)` — for `fileops` (copy, move, delete, archive, bulk download): polls
  `GET api/2.0/files/fileops` until every operation has `finished` / `progress === 100`; operation `error`s are joined
  into one `NodeOperationError`. A finished folder copy/move lists the destination folder in `folders` too, in no
  fixed order — pick results by id / `parentId`, not by position.
- Always pass the item index `i`; `listSearch` methods use `0`.

## Node conventions

- IDs are `number` parameters; rooms/users/formats use `resourceLocator` (modes `list` with `searchListMethod` +
  `manual` with a regex). Read them with `getNodeParameter(name, i, '', { extractValue: true })`.
- "To My Documents" boolean (`isMyDocuments`) resolves the target via `GET api/2.0/files/@my` (`current.id`) instead
  of `destFolderId` / `parentId`.
- Room invitation access levels (`roomInvitationAccessLevels` + per-room-type subsets) mirror DocSpace-server rules;
  `listAccessLevels` picks the subset by `roomType` (1 form filling, 2 collaboration, 5 custom, 6 public, 8 VDR).
- Each case sets `resultDataObject` (and `resultBinaryData` for downloads); after the switch, undefined result →
  "operation not recognized". Output: JSON via `returnJsonArray` + `constructExecutionMetaData` (arrays become
  several items); binary items keep the **input item's JSON** (file info only when the input JSON is empty) and copy
  input binaries. In a workflow, an operation that returns a list (history, searches) makes the next node run once
  per entry.
- Catch: `continueOnFail` → `{ error }`, otherwise **everything** is thrown as `NodeApiError`.
- Delete File / Delete Folder move the item to the trash of the account; it stays there after its room is deleted.
- Download: `asText` converts non-txt/csv to txt/csv via `extsConvertible` from `api/2.0/files/settings`; otherwise
  optional `outputFormat`. Upload: binary or text content, `create_session` + 10 MB chunks, success = HTTP 201.

## Trigger

- Parameters: `name`, `secretKey` (8–30 latin letters), `ssl`, `events` (bit flags; `0` = All Events, otherwise the
  sum). Events are ordered by bit value, not alphabetically. The portal lists its events with bits in
  `GET api/2.0/settings/webhook/triggers` (3.7 has bits above 2^31, e.g. `form.submit`, `agent.created`,
  `file.downloaded`).
- `webhookMethods.default`: `checkExists` (`GET api/2.0/settings/webhook`, match `configs.id` with static data
  `webhookId`), `create` (`POST` with `uri = getNodeWebhookUrl('default')`, stores `webhookId`), `delete`.
- Webhooks: `HEAD setup` answers 200 (DocSpace URL check), `POST default` emits the body as one item:
  `{ event: { trigger: 'file.created', triggerId, … }, payload: <file/folder/room/user>, webhook: { id, name, url } }`.
- DocSpace signs every delivery: `x-docspace-signature-256: sha256=<HMAC-SHA256 of the raw body with secretKey, hex
  upper case>`. It retries a failed delivery 5 times (2^n s), disables the webhook after failures, and deletes it on
  `410 Gone`. A webhook can also be limited to one object with `targetId`.
- The portal registers only a public, resolvable URL that answers its `HEAD` check (localhost or a private IP →
  "URL host is in the blacklist"), so activation fails otherwise. Locally use a tunnel and set `N8N_WEBHOOK_URL`
  (n8n 2.x; `WEBHOOK_URL` is deprecated). Deactivation deletes the webhook; stopping n8n leaves it on the portal.

## Rules and workflows

- Every user-visible change: CHANGELOG `[Unreleased]`, README operation list and the matching `docs/` page (parameter
  names exactly as in the UI).
- New operation: operation option (alphabetical, `action`), parameter banner `resource:operation`, `case` in the right
  resource switch with the DocSpace-server source link, use the helpers above; async `fileops` endpoints go through
  `docspaceResolveAsyncApiResponse`.
- Manual verification against a portal only after the user confirms and names the portal (API Key is the simplest
  auth). Destructive operations (delete, disable user, archive) only on test data.
