# Story validation

The next user-run SDLC invocation populates this index, results.json, each observed story's generated validation block and TODO's Automated validation column. It also updates the separate [bug tracker](../bugs/README.md), even when repairs fail.

No validation has been executed for this implementation. A check-only or documentation-only affected run does not imply any functional story passed. The single supplied API030 failure is explicitly seeded with a historical-unverified fingerprint and an Open bug. No historical passes are imported as current acceptance.

Explicit case/project requirements are in [acceptance.json](../tasks/acceptance.json). Initial reviewed matrices cover accounts, goals, standard workbook imports and worker controls. Other tagged stories receive observed results but cannot receive full automated acceptance until their matrices are reviewed. Add requirements whenever a story changes. Passing automated acceptance does not clear source permissions, functional gaps or native-device approval.

Receipts are tied to a fingerprint of authored code, configuration, test definitions and the acceptance matrix. Source or local configuration changes invalidate old acceptance. Exact retries can accumulate coverage only for the same fingerprint. Post-test tracker updates remain uncommitted; the script never pushes.

Only ACCOUNT-001 currently opts into automatic functional closure via the manifest `_completion` entry. Its reviewed scope is marked Done only after the full current acceptance matrix and check gate pass; failures reopen it. Other stories require implementation/remaining-gate review before enabling closure. Validation always remains visible separately.
