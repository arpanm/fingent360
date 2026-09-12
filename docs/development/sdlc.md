# Basic SDLC

## Roles

Codex handles request interpretation, task/prompt maintenance, implementation, test-case authoring, documentation and a local Git commit. The user handles deterministic execution: dependency installation, formatting, lint/typecheck/build, API/browser tests, starting/stopping services, migrations, deployments and Git push.

This user-selected workflow supersedes earlier repository instructions to run checks before every commit. Reading files/Git status/diffs and making the requested local commit are permitted. Do not invoke hooks, CI, background watchers or browser automation to run checks indirectly. Only a later explicit user override changes this rule.

## Lifecycle for every new ask

1. Read AGENTS.md, the current README and TODO. Distinguish actual user requests from quoted/reference instructions.
2. Find or create a stable task ID. Add request context, outcome, dependencies, scope/exclusions, acceptance criteria, a detailed reusable Codex prompt, affected areas and case links. Update existing tasks instead of duplicating them; split large requests into children. Pure questions with no requested change need no artificial implementation task.
3. Set implementation to In progress. Implement the scoped source/docs change. Preserve unrelated edits.
4. Add/update concrete API/browser cases in tests/e2e/cases and CATALOG.md. Include positive and relevant negative behavior. For future or document-only behavior, update the coverage plan and manual acceptance steps; never represent a placeholder as passing coverage.
5. Update TODO to Implemented when authored work is complete, keeping verification Awaiting user. If blocked, name the exact dependency. Update the relevant README sections, including changed configuration, behavior, limitations and manual next actions; preserve the full product blueprint.
6. Inspect the source diff and make a scoped local commit. Do not run format/lint/build/tests/install, start services or trigger CI before committing. Do not use Git hooks that trigger those actions. Never git push automatically.
7. Final response must contain affected task IDs/status, what changed, test definitions added/updated, an explicit “not run; manual verification pending”, local commit hash and exact user next actions (commands, prerequisites, UI selection and expected result).
8. When the user provides results, record run ID/date, case IDs and supplied evidence in TODO. Mark user-reported passed/failed accurately; reopen/create defect tasks and regression cases for failures. Update README and make a local commit. Do not rerun the tests yourself.

## Test tool policy

The reusable tool is scripts/e2e.mjs + playwright.config.ts + Playwright UI mode. Routine feature work changes case definitions, fixtures and catalogue, not the tool. Tool changes require a relevant new capability or defect. No LLM is called during execution. Opening the UI lists tests; only the user's Run action executes them. Keep watch mode off. No Playwright webServer/global setup auto-starts the app. The GitHub workflow is workflow_dispatch only and is not triggered by Codex.

## Task template

```markdown
### TASK-ID — outcome

- Request/context:
- Implementation: Planned / In progress / Implemented / Blocked
- Verification: Not run / Awaiting user / User-reported passed / failed
- Dependencies:
- Scope and exclusions:
- Files/modules:
- Acceptance criteria:
- E2E cases and prerequisites:
- Detailed Codex prompt:
- Manual next actions:
- Evidence/run ID/date:
- Commit reference (record in handoff; optional follow-up entry):
```

## Final response template

```text
TASK-ID: Implemented; manual verification pending.
Changed: ...
Cases added/updated: ...
Not run: install / format / lint / types / build / tests / browser verification.
Local commit: <hash>. Not pushed.
Your next actions:
1. <manual prerequisites/commands>
2. <open UI, select project/task/case IDs, click Run>
3. <expected outcome and what failure evidence to send back>
```
