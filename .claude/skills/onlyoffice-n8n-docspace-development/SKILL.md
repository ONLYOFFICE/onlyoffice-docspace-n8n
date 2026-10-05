---
name: onlyoffice-n8n-docspace-development
description:
  Development rules for the @onlyoffice/n8n-nodes-docspace package - n8n node API conventions used here, the strict
  n8n-node lint rules, code style, build/lint, unit and automation tests (real n8n against a test DocSpace portal),
  running the nodes in a local n8n with hot reload (including webhooks), CI/release, and the review checklist with
  report format. Use for any TypeScript change in nodes/, credentials/ or test/, for verifying a change, and for
  reviews.
---

# DocSpace package development

Scaffold: `@n8n/node-cli` `0.32.1` (`n8n-node build` / `n8n-node lint`), `n8n.strict: true`, `n8n-workflow` as the only
peer dependency, no runtime dependencies. Types: `node_modules/n8n-workflow/dist/...Interfaces.d.ts`
— read them instead of guessing field names.

## Node API conventions

- Programmatic nodes (`execute`, `webhookMethods` + `webhook` for the trigger); `resource` + `operation` options with
  `noDataExpression: true`; each operation option has `name` (Title Case), `value` (camelCase), `action` (sentence —
  also the AI tool prompt, `usableAsTool: true`).
- Every parameter has `displayOptions.show: { resource: [...], operation: [...] }`. Never rename a parameter `name`,
  operation `value`, `authentication` value or credential property, and never change a type/default on the existing
  node version — saved workflows break. Breaking changes need `version: [1, 2]` + `@version` display conditions.
- Options sorted alphabetically by `name` (exception: trigger events are ordered by bit value); booleans described
  "Whether …". Lookups use `resourceLocator` with a `list` mode (`searchListMethod` in `methods.listSearch`) and a
  `manual` mode with a regex; read with `{ extractValue: true }`. Secrets: `typeOptions: { password: true }`.
- Per item: `getNodeParameter(name, i)`, helpers called with `i`, output via `returnJsonArray` +
  `constructExecutionMetaData({ itemData: { item: i } })` or a binary item with `pairedItem`; `continueOnFail()` →
  `{ error }`, otherwise `NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i })`.
- HTTP only through `GenericFunctions.ts` (`httpRequestWithAuthentication` + credential `authenticate`); never build
  auth headers by hand. Binary input via `assertBinaryData` + `getBinaryDataBuffer`, output via
  `prepareBinaryData(buffer, fileName, mimeType)`. Waiting: `sleep` from `n8n-workflow`.
- Credentials: class name ends with `Api`, `icon` + `documentationUrl` (points to `docs/credentials/README.md` on
  GitHub `master`), `test` request for non-OAuth credentials.

## Strict lint (n8n-node lint)

- Allowed imports: `n8n-workflow`, `lodash`, `moment`, `p-limit`, `luxon`, `zod`, `crypto`/`node:crypto`, relative
  files. Forbidden globals: `setTimeout`, `setInterval`, `setImmediate`, `process`, `global(This)`, `__dirname`,
  `__filename`. `Buffer`, `URL`, `FormData`, `Blob`, `TextEncoder` are fine. No `console.*`.
- `package.json`: no `dependencies`, no lifecycle scripts, no `overrides`; `peerDependencies` exactly
  `{ "n8n-workflow": "*" }`. New dev-dependency licenses that are not MIT-compatible → `.check-licenses.yml`.
- Strict mode checks that `eslint.config.mjs` is the unchanged default — never edit it; disable inline with
  `-- reason`.
- Do not add new lint warnings.

## Code style

Prettier: tabs, single quotes, semicolons, trailing commas, width 100; run `pnpm exec prettier --write <touched
files>` (not `pnpm format`). Description sections separated by `/* ---- <resource>:<operation> ---- */` banners; every
API call preceded by a comment linking the DocSpace-server source (`v3.0.4-server`); request bodies/queries declared
as inline-typed consts; `import type` for types; no copyright headers in `.ts`; strict `tsconfig`, target `es2019`.
Simple English.

## Build and verify

```bash
pnpm install --frozen-lockfile   # when node_modules is missing or the lockfile changed
pnpm build                       # -> dist/ (tsc + copies svg/json)
pnpm lint                        # must exit 0
pnpm test                        # unit tests (vitest)
```

`mise.toml` pins Node 24.13.0 / pnpm 10.28.1 (Node 22 also builds). Not pnpm 12 (creates `pnpm-workspace.yaml`, fails
with `ERR_PNPM_IGNORED_BUILDS`). Not `pnpm dev` (separate n8n instance with a scoped link, no hot reload).

## Tests

| Part                               | What |
| ---------------------------------- | ---- |
| `test/unit/*.test.ts`              | Both nodes, `listSearch`, credentials and `GenericFunctions` with a fake n8n context and a fake portal. `trigger.test.ts` follows the webhook lifecycle like n8n core: registration (`checkExists`, `create`, `delete`), the incoming request (body → one item, signature), the response (HEAD 200, `onReceived`) |
| `test/unit/helpers.ts`             | `runNode({ params, routes, items?, continueOnFail? })` → `{ output, requests }`; `routes` maps `"METHOD url"` to the `response` of the answer or to a function returning the full answer (`reply(body, status)`); `finished()` is a finished `fileops` answer. One fake context serves execute, hook, load-options and webhook functions: `runHook(method, options)`, `runWebhook({ webhookName, body, headers }, params)` → `{ result, response }`, `runListSearch`, `genericContext`. Parameter defaults come from `displayOptions` like in n8n; `authentication` defaults to `basicAuth` |
| `test/unit/webhook-payloads.ts`    | DocSpace deliveries (`FILE_CREATED`, `ROOM_CREATED`, `USER_INVITED`: `{ event, payload, webhook }`) and `signature(body, secret)` for `x-docspace-signature-256` |
| `test/automation/workflows/*.json` | One workflow per area (files, upload/download, folders, rooms, users and auth, trigger): a chain of `@onlyoffice/n8n-nodes-docspace.onlyofficeDocspace` nodes (credentials `dsBasicTestCred1`, `dsApiKeyTestCrd1`, `dsBadKeyTestCrd1`; `onError: continueRegularOutput`); IDs via `$('Node').first().json.id`, the room `$env.TEST_ROOM_ID`, names `$env.TEST_PREFIX`. Nodes that return lists hang off the chain as leaves |
| `test/automation/setup.ts`         | Needs `DOC_SPACE_BASE_URL`, `DOC_SPACE_USERNAME`, `DOC_SPACE_PASSWORD` (fails without them). Creates an API key (expires in a day) and the room `n8n-tests-<time>`, installs the packed package into a temp n8n folder, imports credentials and workflows. Teardown deletes rooms and webhooks with the prefix, new items in the trash and the key |
| `test/automation/docspace.ts`      | `docspace(method, path, body)` (Basic auth) to prepare and check state; `finished`, `poll`, `trash` |
| `test/automation/n8n.ts`           | `runWorkflow(id)` (`n8n execute`, cached per file) → `items/json/error/file/fileName(node)`, `json()` throws on an error item; `start()` for long-running processes |
| `test/automation/trigger.test.ts`  | Cloudflare quick tunnel to `N8N_PORT` (host name from the cloudflared metrics endpoint `/quicktunnel`, like the test containers of n8n) → `n8n publish:workflow` → `n8n start` with `N8N_WEBHOOK_URL` and `N8N_PROXY_HOPS=1`; waits for the webhook on the portal, creates a file, waits for the event in a local collector. The workflow id, `webhookId` and events are read from its JSON |
| `test/run.sh`, `test/docker.sh`    | `run.sh [unit\|automation]` (both by default): pnpm (`mise.toml`) and `pnpm test`; for automation n8n 2.40.7, cloudflared, `pnpm build`, `pnpm test:automation`. `docker.sh [unit\|automation]` runs it in `node:24-bookworm` like CI and passes `DOC_SPACE_*` through |

- `pnpm test` can always be run. `pnpm test:automation` and `bash test/docker.sh` change a real portal (rooms, files,
  an API key, a webhook) — only after the user confirms and names a test portal. Its credentials go only into env,
  never into files, logs or commits.
- A bug fix comes with a test that fails without the fix. A test that describes a known, unfixed bug is `it.fails`
  (it starts failing when the bug is fixed and then becomes `it`).
- One test checks one behavior; table cases go through `it.each`; assertions compare whole objects or exact values.
- Test files start with a `/* eslint-disable @n8n/community-nodes/no-restricted-imports … -- reason */` header: the
  community rules lint them too. `vitest.config.mts` is not linted.
- Automation pitfalls: vitest sets `NODE_ENV=test`, and the n8n CLI then silently does nothing (setup passes
  `production`); `n8n execute` output is cut off in a pipe (it goes to a file) and has run data only at log level
  `info`; binaries are in `.n8n/storage`; n8n 2.x imports workflows inactive and `--activeState=fromJson` works
  only in multi-main/queue mode — a trigger needs `n8n publish:workflow` before `n8n start` (publishing while n8n
  runs takes effect only after a restart). n8n workflow tests (`NodeTestHarness`) start from a Manual Trigger and
  cannot cover webhooks; n8n e2e posts to the local `/webhook/...` URL — only our trigger test lets the portal
  deliver a real event.

## Manual run

The agent itself only builds, lints and runs unit tests. Starting n8n, changing its setup and sending any request to a DocSpace portal
happen only after the user confirms (and names the portal). Manual run in the user's WSL n8n:

- The repo is linked **unscoped** into `~/.n8n/custom/node_modules/onlyoffice-docspace-n8n` (a scoped
  `@onlyoffice/...` link is not watched). The WSL copy of the repo is separate from the Windows one — sync edits.
- n8n runs with `N8N_DEV_RELOAD=true`, `NODE_ENV=development`, `N8N_SECURE_COOKIE=false` plus `pnpm exec tsc --watch`
  in the repo. Log `Hot reload triggered for CUSTOM` = reloaded; description changes may need a page refresh,
  svg/json changes a restart. Node types: `CUSTOM.onlyofficeDocspace`, `CUSTOM.onlyofficeDocspaceTrigger` (+ `…Tool`).
- Trigger: the portal registers only a public URL that answers its `HEAD` check — set `N8N_WEBHOOK_URL` to a tunnel
  address (`cloudflared tunnel --url http://localhost:5678`, zrok, ngrok); activate the workflow, check the webhook
  in DocSpace developer settings, and that deactivation deletes it.
- Check per touched operation: each affected auth type (API Key is the simplest), one error case with and without
  "Continue On Fail", two input items. Destructive operations only on test data.
- Changes to the trigger, Download File or Upload File: also run the chain real workflows are built on — Trigger (File
  Uploaded) → Download File (binary and `asText`) → Upload File (binary and text content) → Get File Shared Link.

Report in the PR which operations/auth types were run manually and against which DocSpace version.

## CI and release (Gitea Actions at git.onlyoffice.com, mirrored to GitHub)

- `audit.yml` (push/PR to `master`, `develop`): frozen install, check-licenses, build, lint, then
  `npx @n8n/scan-community-package @onlyoffice/n8n-nodes-docspace` — it scans the **published** npm version, not the
  working tree.
- `test.yml` (push/PR to `master`, `develop`): jobs `unit` (`bash test/run.sh unit`) and `automation` (`needs: unit`,
  `bash test/run.sh automation`), like unit and e2e jobs in n8n; both in a `node:24-bookworm` container, the same as
  `test/docker.sh`. `automation` gets `DOC_SPACE_BASE_URL`, `DOC_SPACE_USERNAME` from Gitea `vars` and
  `DOC_SPACE_PASSWORD` from `secrets` (the same as onlyoffice-zapier) and needs outbound internet (cloudflared).
  No `concurrency`: two runs at once share the portal.
- `paths-ignore` on `test.yml` and `audit.yml`: `**/*.md`, `LICENSE`, `.gitignore`, `.github/**` (plus
  `.check-licenses.yml` for tests). A push that only changes a workflow does not run it — use `workflow_dispatch`.
- `stage.yml` (push to `develop` touching `credentials/`, `nodes/`, `package.json`): `pnpm pack` tarball.
- `master` push changing `package.json` → `create-tag.yml` tags `v<version>` → `release.yml` publishes to npm with
  provenance and creates a GitHub release. Never bump `version` unless the user asks for a release.
- `CHANGELOG.md` is Keep a Changelog: entries under `## [Unreleased]` → `### Added / Changed / Fixed`.

## Branches, commits, PRs

- Work branches from `develop`, named `<type>/<short-name>` (`feat/…`, `fix/…`, `chore/…`); PRs target `develop` in
  Gitea. `master` changes only through a release.
- Commit messages: Conventional Commits in lower case (`feat: …`, `fix: …`, `chore: …`). No
  `Co-Authored-By: Claude` trailer.
- The agent works locally only: commit to the work branch when asked; push and PR only after the user confirms;
  never commit to `develop` or `master` directly.

## Review checklist

1. Correctness: endpoint, method and body match DocSpace-server at the linked version; responses read from
   `body.response`; `fileops` endpoints awaited via `docspaceResolveAsyncApiResponse` and their results picked by
   id, not position; `isMyDocuments` branches handled; unit tests cover the change.
2. Items: helpers and `getNodeParameter` get the item index; `pairedItem`/`itemData` set; `continueOnFail` works.
3. Auth: works for all four credential types (OAuth2 base URL comes from the token `aud`; OAuth2 scopes cover the new
   endpoint); trigger stays without OAuth2.
4. Security: no secrets in parameters, output JSON or errors; webhook payloads treated as untrusted.
5. Compatibility: no renamed/removed parameter names, operation values, credential fields, output keys, default
   binary field; access-level values unchanged.
6. Lint/build clean with no new warnings, `eslint.config.mjs` untouched, lockfile in sync, `version` untouched;
   CHANGELOG, README and `docs/` pages updated for user-visible changes.

Report format:

```markdown
## Findings
- Blocker: `path:line` - issue, why it matters, minimal fix.
- Should fix: `path:line` - risk, suggested fix.
- Nit: `path:line` - style.
## Checks run
- lint, build, manual runs, requests sent.
## Not verified
- e.g. no DocSpace portal available, trigger not tested.
## Summary
- One or two sentences.
```
