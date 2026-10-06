# Tests

```bash
pnpm test               # unit tests, no services needed
bash test/docker.sh     # everything in Docker, in the CI container (or: unit, automation)
```

CI runs only the unit tests. The automation tests run only locally: they change a real DocSpace
portal and the trigger test needs a Cloudflare tunnel. They need a test portal:
`DOC_SPACE_BASE_URL`, `DOC_SPACE_USERNAME` and `DOC_SPACE_PASSWORD` of its owner or an admin, set in
the environment (the same names as in onlyoffice-zapier). Without them the automation tests fail.

- `test/unit` — the nodes with a fake n8n context and a fake portal. `helpers.ts` resolves
  parameter defaults from the node description like n8n does, so reading a hidden parameter fails.
  `trigger.test.ts` follows the webhook lifecycle: registration, incoming request, response, with
  the DocSpace deliveries from `webhook-payloads.ts`.
- `test/automation` — workflows in `workflows/` executed by a real n8n against the portal.
  `setup.ts` installs the packed package into a temporary n8n folder, creates a temporary API key
  and a test room, imports the credentials and the workflows, and afterwards removes everything the
  run left: rooms, trashed files and folders, webhooks and the key. The trigger test publishes its
  workflow, gets a public URL for n8n from a Cloudflare quick tunnel (the portal accepts only public
  webhook URLs, n8n uses the same tunnel in its own test containers) and waits for the event of a
  file it creates.
- `test/run.sh [unit|automation]` — installs pnpm, runs the unit tests; for the automation tests
  installs n8n and cloudflared and builds the package. CI (`.github/workflows/test.yml`, job `unit`)
  runs `run.sh unit`; with `CI` set, `run.sh` refuses the automation tests. `test/docker.sh` runs
  it locally in the same `node:24-bookworm` container.
