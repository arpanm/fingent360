# NAMED-OPERATORS-001 authoring handoff

Implementation is authored in the shared main checkout. No test, build, formatting, lint, migration, provider request, service action, Git commit or push was executed. The existing working tree contains other agents' feature changes; this handoff is scoped to named Operations only. Parent owns tracker/catalogue updates and shared migration/provider integration.

## Interfaces and files

- Contracts: `packages/contracts/src/operator-identity.ts`, `named-operators.ts`, additive `discovery.ts` session fields and index export. Unit definitions: `packages/contracts/test/named-operators.test.mjs`.
- Migration: `infra/migrations/038_named_operators.sql` (parent registers). Default mode is bootstrap; configuration is additive in `apps/api/src/config.ts` and `.env.example`.
- Core API: `named-operator-store.ts`, `named-operators.ts`, `publication-proposals.ts`, `operator-permissions.ts`, `operator-internal.ts`; existing `operator.ts` delegates named sessions. Root app imports/registers the two controllers and central guard; existing providers remain reused. `PublicationProposalsController` additionally injects `ECB_RATE_STORE`, so migration040/ECB provider registration must accompany integration.
- Final admission and explicit permission metadata: `discovery.ts`, `media.ts`, `sources.ts`, `macro.ts`, `ops-legacy.ts`, `securities.ts`, `feedback.ts`, `retention.ts`, `worker-health.ts`, `operator-audit.ts`, `publishing-queue.ts`, `quality-overview.ts`. Preserve other agents' changes when reviewing these shared files.
- Provisioning: `apps/api/src/provision-operator.ts`, `scripts/operator-provision.mjs`, package command `ops:provision`; `scripts/runtime-env.mjs` strips temporary owner credential variables from runtime children.
- UI: `NamedOperations.tsx`, `ProposalInspection.tsx` (actual typed source/registry/media/rates target read), additive named login/tab/proposal callbacks in `Operations.tsx` and `SourceReview.tsx`. Existing guarded parent request owns session invalidation. Receipt reload reconciles selected detail; successful saved replies do not depend on a second read.
- Test fixture: `feedback-fixture.ts` option `namedOperators`; explicit mode and private synthetic owner provisioning in `feedback-api-process.mjs`. Default cases always use bootstrap, even if the user's deployment is named. Named fixtures force query-mode media generation; no paid-provider call is needed. Credentials are IPC-only to the test and failure tracing/screenshots/video are disabled for named specs.
- API definitions `cases/api/named-operators.spec.ts`; browser definitions `cases/browser/named-operators.spec.ts`; guard definitions `apps/api/test/operator-permissions.test.mjs`.

## Central mutation inventory

All paths below are prefixed `/api/v1`.

| Permission                                    | Endpoints                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prepare (researcher/admin)                    | POST `/ops/discovery/refresh`; POST `/ops/discovery/bea-attempts/:id/revalidate`; POST `/ops/discovery/bea-staging`; POST `/ops/macro/refresh`; POST `/ops/securities/refresh`; POST `/ops/media/:id`; PUT `/ops/proposals/:id`; ECB refresh through its independently registered prepare metadata |
| approve (publisher/admin, different identity) | POST `/ops/proposals/:id/approve`; POST `/ops/proposals/:id/reject`                                                                                                                                                                                                                                |
| administer (admin)                            | POST `/ops/operators`; PUT `/ops/operators/:id`; PATCH and DELETE `/ops/feedback/:id`; POST `/ops/retention/previews`; POST `/ops/retention/runs/:id/execute`; POST `/ops/workers/:worker/control`                                                                                                 |
| denied direct public mutation in named mode   | PUT `/ops/discovery/items/:id`; PUT `/ops/media/:id`; POST `/ops/sources`; PUT `/ops/sources/:id`; ECB direct review through its blocked metadata                                                                                                                                                  |

Protected GET controllers require explicit `OperatorRead`; the admin roster additionally requires admin permission inside its store. Unknown Operations mutations default denied, including aliased/leading-slash controller paths. The explicit `/ops/session` GET/POST/DELETE interface remains its own login/session/logout boundary with Origin and credential validation.

Legacy bearer paths denied in named mode regardless of supplied `RESEARCH_ADMIN_TOKEN`: GET `/sources/operator`, GET `/sources/:id/history`, POST `/sources`, PUT `/sources/:id`, POST `/macro/refresh`. Ordinary public source/macro reads retain their public projection. An in-process Symbol capability allows already guarded internal adapters; an HTTP header cannot supply it.

## Executable acceptance definitions

Tag: `@NAMED-OPERATORS-001`.

- API640: actual named roles, shared-key denial, direct legacy/public-mutation bypass rejection.
- API641: actual source proposal, unchanged head before approval, independent approval, exact decided replay, stale head409, disabled-session401.
- API642: administrator self-review denied across two sessions, independent registry rights publication, oversized continuation400.
- API643: observed exact source SELECT blocked by an owned row lock; committed identity disable while it waits;401 and unchanged source/pending proposal after release; all owned requests drained.
- API644: generated source-bound media initially private, independent rejection with exact replay, then independent publication and real public read.
- WEB640 (desktop/mobile): actual named publisher sign-in, proposal detail, committed approval response aborted, same action retried, exact receipt equality, saved historical status and reload.
- WEB641 (desktop/mobile): actual administrator creates a viewer through UI, disables with confirmation, reload persists state; password cleared.
- Unit definitions: proposal decision/chronology/unknown-field and bigint limits; controller alias/default-deny/read checks, bootstrap compatibility.
- Existing runtime-environment unit coverage also checks that temporary operator setup credentials are removed from API child environments without mutating the caller's configuration.

Existing offline Operations is deliberately connected-only; no named identity database or publication is created on-device. Preserve its existing no-network Operations cases. This is not a claim that all legacy tests or new cases have passed, nor that every numerical ingestion pipeline gains two-identity review.

## User-run acceptance

No dependency was added. Use the repository's manual SDLC sequence (`pnpm sdlc "Add named operator review"`) only after reviewing the integrated changes, or the explicit manual `pnpm build`, `pnpm db:migrate`, `pnpm dev` sequence required by current repository setup. Start `E2E_BROWSER=chrome pnpm e2e:ui`, leave watch/eye toggles off, and select `@NAMED-OPERATORS-001` in API/desktop/mobile projects. Run `pnpm check` manually for guard/contract definitions. Expected results are the assertions above; report the run ID, exact case ID and `artifacts/e2e/latest.md` on failure.

For a real deployment choice, follow the separate explicit owner-provisioning steps in `docs/product/named-operators.md`; test fixtures do not modify the user's operators or configuration. Do not put real credentials into traces or Git. No local commit hash is claimed by this author; parent/user owns final scoped commit after the chosen manual gates.

## Freeze and limits

Authoring frozen at base commit `b5cfcd0`; the feature remains uncommitted along with unrelated shared work, by the current no-execution instruction. ECB schema/store interface is agreed and wired; root must preserve its provider/controller/migration040 integration. No dependency install is required.

The authored automated cases total five API and two browser definitions (browser definitions apply to desktop/mobile project selections), plus four unit definitions. They do not claim execution. Owner CLI provisioning/recovery under unavailable storage, the complete role matrix across every legacy handler, and a held named-UI401 during a tab switch remain manual/static acceptance here; existing parent Operations session barriers and legacy cases are reused, not represented as new named-case execution. Distinct identity IDs do not establish distinct human persons. The feature does not add an investor-facing offline operator database, MFA, invitations/email delivery, automatic credential distribution or regulation/licensing approval.
