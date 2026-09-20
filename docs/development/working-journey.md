# Working virtual journey — SLICE-001

The source now implements the browser/API/database journey. It has not been executed by Codex, following the manual-execution workflow. Test definitions are executable; “not run” describes verification, not missing implementation.

## Manual setup and verification

No dependencies changed. From the repository root, with the existing `.env`:

```bash
pnpm db:up
pnpm format
pnpm check
pnpm db:migrate
pnpm dev
```

`pnpm check` builds the API containing the migration command before `db:migrate` is invoked. The new migration creates only the `virtual_*` tables, is repeatable, and preserves existing data. Do not start a second `pnpm dev` if one is already using the ports; stop that terminal first or reuse its watchers after the build/migration.

Open http://localhost:5173. Follow Market brief → event → company/source notes → Import CSV. Open a virtual workspace, preview the supplied example (10 Alpha Air shares + INR 1000 cash; declared INR 2000), then confirm. Add two education goals allocating 40% and 60%; save. Funding is INR 800/1200 and attributed exposure INR 400/600. Create a baseline review, then simulate stale and conflicting inputs. Reload to see persisted holdings/goals/history. Use Workspace access and deletion to remove your exercise data.

For manual test execution, keep the API/web and PostgreSQL/Mongo running:

```bash
E2E_BROWSER=chrome pnpm e2e:ui
```

Open http://127.0.0.1:9323, leave watch mode off, filter `@SLICE-001`, select **api**, **desktop**, and **mobile**, then click Run. E2E-API-010–013 and E2E-WEB-010–012 are real runnable cases. Also rerun the foundation browser cases because its landing page changed. Tests create isolated fictional workspaces and delete them on completion; a forcibly interrupted run may leave its workspace until manually removed with its key. No real portfolio data is involved.

E2E-WEB-2315 adds the complete keyboard-only journey on desktop/mobile. Its 20 September desktop repair makes the application router the sole panel-route owner, explicitly associates the import controls with their labels, and asserts that Tab/Enter selection of Import CSV updates the URL, `aria-current` state, visible import heading and labelled CSV textarea before editing. The repair is authored, not validated. The smallest retry is:

```bash
pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard\.spec\.ts' --project=desktop --grep 'E2E-WEB-2315 full keyboard virtual journey edits imports allocates reviews reloads and deletes actual synthetic workspace @SLICE-001 @TEST-SIMULATION$'
```

Expected: all selected cases pass, including reconciliation failures leaving revision zero, replay without duplicate writes, cross-workspace 404/unauthenticated 401, preserved review inputs, visible stale/conflict blocks and responsive layouts. For failure, share case ID/project, error/expected-versus-actual and trace/run ID from the UI. Do not share workspace keys or `.env`.

## Endpoints

All under `/api/v1/journey`. Public `GET catalog` and `POST workspaces`. Private endpoints require the returned capability in `Authorization: Bearer <token>`: `GET/POST/DELETE workspace`, `POST previews`, `POST imports`, `GET/POST reviews`, `GET reviews/:id`. Credentials are never passed in query strings. JSON validation rejects unknown input fields. A save requires `expectedRevision` and an idempotency UUID; an import additionally needs a matching unexpired preview.

The browser stores only its virtual access key in localStorage. PostgreSQL holds portfolios, goals, parsed previews and immutable responses/reviews. Copying the key grants access; this is deliberately limited to fictional local workspaces, not real account authentication.

## Remaining roadmap

The full product backlog is not complete. Live data source rights/adapters, real identity/consent, ISIN security master, broker CSV/XLSX formats, per-position goal allocations, profile/suitability, full canonical migrations, report workers, PWA, production controls and regulated advice remain their existing TODO tasks. This working slice implements and exercises the core workflow without claiming those integrations exist.
