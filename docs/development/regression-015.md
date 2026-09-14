# REGRESSION-015 — full SDLC repair

The user explicitly authorized deterministic checks and E2E execution for this repair on September14, overriding the default manual execution boundary for this task only.

## Changes

- Supply descriptive navigation guards for lineage and identity-selection drafts.
- Correct UUID state, event array, saved assessment and optional callback types without weakening runtime validation.
- Correct E2E worker fixture types, nullable responses and DOM iteration.
- Keep excerpt offsets and quote bounds consistently measured in UTF-16 units, including supplementary Unicode characters. Existing extraction coverage and added citation-boundary assertions cover the regression.
- Apply the pending additive local migrations and runtime grants so new consent-dependent operations can execute. Existing data is preserved.

- Abort model dispatch when the selected reference set changes before final admission; keep query fallback and discard stale private context.
- Preserve PostgreSQL due-time microseconds when deferring a failed material-check account, allowing other due accounts to progress.
- Drain periodic workers during module destruction before application-shutdown closes database pools.
- Gate the goal assessment panel on a successful goal load so a secondary auth response cannot erase an initial outage.
- Repair pagination fixture timestamp casts, route fallback to the owned API, native-select keyboard opening, and waits for enabled source/candidate controls. No assertions were removed.

## Verification

Initial format/lint and application/E2E typechecks passed after corrections. Contract130, API105 and root33 unit tests passed before the additional citation assertion. Full API/desktop/mobile E2E completed: 739 passed,26 failed,1 intentional manual-outage skip across766 cases in40.3minutes (run1789400199483-daa21105-5968-4ac7-b701-c4a9a9556eb1). Fresh extraction6/6, identity2/2 and rate-recovery1/1 reruns pass. The final affected-case SDLC rerun passed31/31 in2.3minutes (run1789402885873-bc7de838-2725-4dd3-ab63-eb00fbf6c45a). Format/check and268 units passed. Fixes are committed ina9ca213 and5fc0907; nothing pushed. The user restored the manual execution boundary afterward. Later SDLC launcher optimizations are separate, unverified changes.
