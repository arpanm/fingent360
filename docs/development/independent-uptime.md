# Independent uptime observer

Authored implementation; no monitor was started and no uptime was measured.

`scripts/uptime-monitor.mjs` runs without the Fingent360 API, PostgreSQL or MongoDB. It probes only locally configured health/readiness endpoints, persists a separate local journal and serves a read-only loopback review page. Deploy it on a different machine/network/failure domain to observe an entire application outage. Running it beside the API is useful for local diagnosis but does not establish independent deployment availability.

## Configuration and operation

Copy `infra/local/uptime.example.json` to a private operator configuration. Its loopback API port4100 is an example; replace it with the actual printed development port. For deployment use `allowLoopback:false` and exact public HTTPS target URLs ending `/api/v1/health` and `/api/v1/ready`. HTTPS target port443 is the default; other remote ports, URL credentials/query strings, redirects and arbitrary paths are rejected. The process supports public IPv4 endpoints only. Public DNS results are validated and pinned into a certificate-verified connection; private/reserved answers are refused. Configuration is never accepted over HTTP.

User-run command:

```bash
node scripts/uptime-monitor.mjs /absolute/operator/uptime.json /absolute/persistent/monitor/state.json
```

The state directory must be persistent and writable by that operator. The process creates restricted-permission files, flushes a new journal before replacement and uses an exclusive lock to prevent two writers. SIGINT/SIGTERM finishes the current observation cycle before releasing the lock. After an unclean crash, inspect the lock PID and confirm that no monitor owns that state file before manually removing the stale `.lock`; never remove a live monitor lock. A corrupt journal or changed target configuration fails startup instead of silently resetting history. Preserve the original and choose a new journal after an intentional configuration change.

Open `http://127.0.0.1:9410` (or configured port). The page shows latest persisted classification, latency, observation time and open/recovered incidents; refresh is explicit and keyboard accessible. The listener rejects nonlocal Host and all writes. For remote administration, use an authenticated SSH tunnel to the loopback port; do not expose this unauthenticated local viewer to a network or public proxy. No phone/email/Slack notification is sent.

One to ten configured targets are checked concurrently; each DNS lookup and request is bounded to five seconds and each body to16KiB. Health requires the actual application service identity, status and timestamp; readiness requires both database dependencies up. Poll interval defaults to60 seconds (minimum30), measured after each completed cycle. Failed connection/TLS/status/body validation opens an incident on the first observed failure. A later successful observation records recovery. An observer gap never proves continuity or exact outage duration: observations older than three intervals are unknown, as are future-dated clock anomalies. The UI treats journal-write failure as unknown and retains the last durable evidence. No SLA percentage is calculated.

Retain up to10,000 recent observations and500 incident episodes; active episodes are preserved. Export/archive the state file with normal operator backups before retention removes older resolved history. Raw response bodies, URLs, cookies or credentials are not persisted in observation records. Named target IDs are operator-defined operational labels, not customer identifiers.

## Manual acceptance and release evidence

No dependency or migration is needed. User-controlled API/browser cases: API1650–1651 and WEB1650 desktop/mobile (`@DEV-021 @TEST-SIMULATION`). They create temporary owned HTTP endpoints/journals to exercise actual observation, durable reopen, recovery, unknown gaps, unsafe target rejection, redirects, misleading bodies, actual viewer refresh and rejected mutation. Synthetic target failures are labelled; no real deployment uptime is asserted.

Run `pnpm sdlc "Validate independent uptime observer" -- --grep "E2E-(API-165[01]|WEB-1650)"`. Report failed case ID and saved artifact context. Separately, deployment owner supplies monitor host/failure-domain ownership, persistent storage/service supervisor, actual target configuration and observed controlled outage/recovery evidence. Backups/restores, performance, security and physical-device release checks remain separate DEV-021 acceptance. This local observer does not replace those gates.

Primary technical references: [Node HTTPS request and TLS options](https://nodejs.org/api/https.html), [Node file flush and rename APIs](https://nodejs.org/api/fs.html). The implementation uses native APIs rather than a new monitoring infrastructure dependency.
