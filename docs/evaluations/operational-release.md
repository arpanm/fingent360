# Operational release acceptance — DEV021

These are user-run acceptance criteria, not measured results. The local request counters reset with each API process. They cannot substantiate a multi-process or monthly SLA. A deployment must retain its own restricted, aggregated readiness and request measurements before any service-level claim.

## Initial objectives

| Concern               | Initial acceptance objective                                                             | Measurement and exceptions                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| API availability      | At least99.5% successful readiness probes over a rolling30 days                          | Independent deployment probe; planned maintenance disclosed separately; no historical attainment claimed                   |
| Interactive reads     | p95 below1 second for admitted small record/read endpoints at10 concurrent users         | User-owned isolated benchmark; exclude explicitly asynchronous uploads/provider fetches; retain hardware/data-size context |
| Storage integrity     | No issued receipt/revision mutation and no cross-account disclosure                      | Existing ownership, immutable revision, replay, withdrawal and final-admission suites                                      |
| Publication quality   | Zero invalid/missing head editions, missing external evidence or unreviewed public heads | Operations → Data quality; inspect truncation before treating counts as global                                             |
| News retrieval triage | Flag retrieval older than168 hours                                                       | Historical validity and source release cadence are separate; annual/glossary excluded                                      |
| Worker responsiveness | Existing30-second heartbeat freshness target                                             | Worker health marks not-observed/stale rather than fabricating success; paused workers are explicit                        |
| Restore acceptance    | Complete consistency of both databases and immutable receipt reconstruction              | Separate disposable restore environment; never overwrite the current app to test recovery                                  |

Objectives are initial engineering targets, not a commercial SLA or a release authorization.

## Release sequence

1. Record the candidate Git revision, schema ledger checksums, configuration key names (not values), approved source rights and packaged public snapshot date. Review all uncommitted files before the user's SDLC command stages them.
2. Run the feature's focused API/browser/offline cases through the user-owned SDLC command. Run broader affected ownership/reconciliation cases when changing shared boundaries. Retain the manifest and individual failures, not merely a screenshot of totals.
3. Apply additive migrations with migration-owner credentials and refresh runtime grants. Old application code must be schema-compatible before any rollback. Never edit an already-recorded migration.
4. Check current readiness, Operations quality, Worker health and actual source review receipts. Failed requests can be correlated through X-Request-ID to one redacted structured completion log. A request log does not prove a mutation committed; the saved domain receipt is authoritative.
5. User reviews desktop/mobile keyboard, reflow and loading/error states. Android requires a fresh bundle/build/reinstall and separate device acceptance; web deployment does not silently update an installed APK.
6. Retain a rollback decision and responsible operator. Do not publish, push or deploy automatically.

## Backup and restore drill

Use an owner-approved encrypted backup destination with limited read access. Capture PostgreSQL and MongoDB at an operationally consistent boundary: pause admission of new work using existing worker controls, allow admitted work to settle, stop writes during coordinated capture, and retain public evidence hashes plus schema ledger. Do not log connection URLs or credentials. Named Docker volumes are live data, not backups.

Restore both databases into newly created, isolated databases/volumes with separate credentials and loopback ports. Point a separate app instance at them; leave original endpoints untouched. Check migration checksums, row counts, source-document hashes, immutable issued report inputs, holdings/goal totals, account boundaries and runtime DDL denial. Replaying one preexisting request must return its original receipt without duplicate work. A deliberately absent Mongo evidence document must produce an unavailable source state, not reconstructed invented text. Record backup/restore times, recovery point, selected cases and exact failures. Resume the original app only through the user's explicit operational commands. Destroy only the drill's verified owned data when the user approves cleanup.

## Rollback and kill switches

Use Worker health pause for report/reminder admission; already-admitted work may complete. Withdraw an incorrect publication through its existing reviewed new edition. Keep source history and private issued originals. For a bad migration, preserve backups and apply a reviewed additive repair; do not drop tables or rewrite the migration ledger. Revert application code only after documenting compatibility with the database. For session compromise, revoke relevant sessions and rotate configuration secrets through the deployment owner; never put replacement secrets in issues or logs.

## Evaluation matrix

- **Reconciliation:** exact money/quantity totals before/after imports, replay and failed requests; no baseline change on invalid input; original receipts reconstruct after source corrections.
- **Performance:** small/large owned datasets,10 concurrent readers, p50/p95 latency, response sizes, query counts, connection pool saturation, bounded queue/quality result limits and timeout recovery. Compare with recorded hardware/baseline rather than relaxing thresholds after a failure.
- **Security:** guest and foreign-owner access, Origin rejection, expired sessions after storage waits, upload bounds, formula/HTML/untrusted-instruction payloads, safe logs without raw query/body/header data, source withdrawal and non-superuser DB privileges.
- **Failure recovery:** interrupted response after committed mutation, API restart, worker lease expiry, PostgreSQL unavailable, Mongo evidence unavailable, malformed provider data and returned503 retry. Only explicit owned fault fixtures may alter availability.
- **Mobile/offline:** shared domain calculations, protected data masking, device restart/persistence, real Back/keyboard flows, pending feedback sync and new APK update retention.

No benchmark, security review, restore drill or production deployment was performed while authoring this plan. Runtime metrics and current quality counters are implemented locally; deployment retention/alerts and measured release acceptance remain open.
