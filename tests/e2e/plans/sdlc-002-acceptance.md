# SDLC-002 manual acceptance

Prerequisites: run pnpm format and pnpm check manually; start the app and databases, then reopen E2E_BROWSER=chrome pnpm e2e:ui. No new packages required. Keep watch toggles off.

- SDLC-UI-001: Click Run for E2E-API-001/002 and E2E-WEB-001. Open artifacts/e2e/latest.md in the editor. It must contain this run's selected-case count, targets, project/case names, locations and outcomes. Opening the UI without running cases must not replace the report.
- SDLC-UI-002: In a separate UI session, explicitly set E2E_API_URL to a loopback port you know has no listener and run only E2E-API-001. The summary must include the failed case and connection error. Ask Codex to read artifacts/e2e/latest.md; no copied browser text or rerun is needed. Reopen normally to restore the correct target.
- SDLC-UI-003: Run the healthy E2E-API-001 alone. Latest evidence must exclude the previous failure, while its historical file remains under artifacts/e2e/handoffs. A partial run must not claim the entire suite passed.
- SDLC-UI-004: Stop an active run in the UI. The summary must show interrupted/incomplete results rather than success. Skipped cases, including conditional outage cases, must remain labelled skipped.
- SDLC-UI-005: Manually run pnpm e2e:run --project=api --grep E2E-API-001. The same summary format must be produced alongside the existing HTML/JSON reports.
- SDLC-DOC-001: Inspect TODO, README, CATALOG and the local commit. Authored status must be separate from verification; handoff must identify any pre-existing changes left uncommitted. No push or automatic execution is permitted.

Status: authored; not executed. Report failures by supplying the local summary path. Reporter unit cases exercise failure/skip/pass, rerun replacement, history, interruption and redaction using temporary files only when the user runs pnpm check.
