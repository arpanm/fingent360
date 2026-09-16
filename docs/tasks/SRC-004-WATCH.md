# SRC-004-WATCH — Watch verified original financial filings

- **Status:** Completed implementation; validation pending.
- **Scope:** Check a fixed researched25-company original-URL registry, at most three selected originals per due run. Preserve unchanged/corrected/quarantined/unavailable outcomes and raw bytes, create drafts only, independently review through the existing equity workflow, and expose admitted facts in company/derived/offline views.
- **Specification:** [Original filing watch](../development/filing-watch.md); [parent](SRC-004.md).
- **Data:** Migration127 adds disabled permission/schedule controls and immutable attempts; existing equity editions/observations and Mongo originals are reused. Gate revocation is enforced centrally for fresh company and downstream fundamental reads. Offline copies remain dated snapshots.
- **Cases:** API1990–1992, WEB1990 and OFFLINE1990; actual storage/review/worker paths with simulated upstream transport. Not executed.
- **Remaining:** User validation and actual source permission/activation. This watches known historical URLs; new-release URL discovery and original XBRL remain separate missing parent scope.
- **Manual next action:** With configured PostgreSQL/MongoDB/API/web, run `pnpm db:migrate`, then `pnpm sdlc "Validate original filing watch" -- --grep "E2E-(API|WEB|OFFLINE)-199[0-2]"`. Use Operations → Original filing watch and Automatic research at the printed development URL. Report selected case/project and saved error-context/run directory.
- **Commit:** No gates, jobs, migrations, app builds or commit executed. Baseline `a2c53a0`; manual SDLC owns the conditional commit.

## Reusable task prompt

Read AGENTS.md and linked acceptance. Resolve concrete failures in permission-bound original acquisition, unchanged/correction handling, immutable source review or central admission. Never substitute a known historical-URL watch for new-release discovery; never auto-publish findings or accept arbitrary fetch URLs. Update cases/docs/status, leaving deterministic execution manual.
