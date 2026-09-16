# DEV006: five/six-point reviewed intelligence brief

Implementation authored2026-09-15; no deterministic validation or live activation was run.

## Scope and pipeline

The original public intelligence requirement is five/six verified editorial points with event, sector and company detail, supporting sources, corrections and unavailable/stale handling. It does not require estimated share-price causality. This workflow selects exactly5 or6 distinct currently published reviewed **fact events**; each point is its existing explanation and source citations, not new generated text. Duplicate source-citation sets cannot pad the count. Every issued brief has actual reviewed sector and company context across its points; an insufficient candidate pool stays explicitly empty/incomplete.

Protected Operations candidates come from the actual EventStore, re-admitted against current discovery publications, identity versions and supersession/lineage. A preparer chooses event IDs/versions, title and editorial reason. A different named reviewer issues the immutable prepared receipt after re-admission. Source content does not trigger actions or instructions. There are no LLM calls, provider downloads or generated financial numbers in brief generation.

Migration091 retains a brief head, immutable version payloads and immutable review records. Later drafts preserve the previous issued version until independent issue. Public reads re-admit each point: unchanged event displays; changed/withdrawn/unavailable source, identity or event hides that issued point's content and presents an explicit current-event link. It never silently substitutes an updated event into an old brief. A newly prepared/reviewed brief version can restore corrected content. Withdrawal suppresses all points. History exposes issued version/time metadata, not unreviewed drafts or withdrawn source text.

All locks and account/operator authorization remain server-side. Read admission locks event IDs, source IDs and identity keys in stable order; source updates stay governed by the existing source modules. Preparation/review serialize writes and retain idempotent request fingerprints; changed-input replay409 and same-author publication403 are explicit. Public data has no user portfolio or goals, so no new private encryption/export bucket is needed.

## API and experience

Public `/api/v1/intelligence-briefs`, `/:id`, `/:id/history`, `/snapshot`; protected `/api/v1/ops/intelligence-briefs`, `/candidates`, PUT`/:id`, POST`/:id/review`. Lists page50, candidate lists page50, histories page50; snapshot rejects more than100 briefs or4MiB instead of silently truncating. Drafts do not appear publicly.

Shared web/Android reader `#intelligence-briefs[/id]` shows the five/six points, issued version/time, source freshness and unknown announcement time, expandable supporting source/sector/company links, exact event navigation, history, loading/empty/error/retry and keyboard/mobile layout. Today/More navigate to this workspace. Company links use the existing canonical identity and admitted equity evidence screens; no fabricated company detail is filled when coverage is unavailable.

Operations → Editorial briefs supports actual candidate selection, page navigation without discarding selected IDs, a5/6 selection counter, independent issue/withdraw and corrected-version preparation. A selected stale event version is identified; the editor explicitly reselects the new reviewed version. The user can inspect every event/source before issuing.

Offline snapshots retain public brief points/history and reuse the existing event/source/identity/lineage handler before display. A removed or changed installed source hides its point, without network or replacement text. Preparing/reviewing remains API-only. Earlier history beyond the installed window produces explicit recovery. A snapshot cannot know later server withdrawals; rebuild/refresh and APK reinstall remain manual.

## Authored acceptance

API1520 exercises five actual historical source points, named independent issue, short-count rejection, immutable issued version and source withdrawal suppression. API1521 changes an actual reviewed event, suppresses the old point, then issues corrected brief2 and preserves history1/2. WEB1520 checks five points, keyboard source expansion, event/sector/company navigation, Back, withdrawal and narrow-screen width. OFFLINE1520 removes retained source admission and verifies exactly one hidden point and no invented substitute with network disabled.

The acceptance pack uses actual historical FOMC/BEA source fixtures and the actual minimal IndiGo fuel disclosure; source/provider admission and the identity resolver are explicitly simulated, as are any incidental private fixtures reused by the source helper. It demonstrates real sourced content shape and actual API/storage workflow, not licensed production ingestion or test passes. Existing original-source fixture provenance remains in their respective task notes.

User next actions: no new dependency. With configured PostgreSQL/MongoDB, run `pnpm db:migrate` including091 and start `pnpm dev` if needed. Run `pnpm sdlc "Add reviewed public intelligence briefs" -- --grep "@DEV-006"`. Use the actual printed web origin at `/#ops` → Editorial briefs and `/#intelligence-briefs`. Expect exact5/6 reviewed points, sources/context, independent issue, immutable correction history and explicit hidden withdrawn content. Report saved run, failed case/project and full error on failure. No formatter, check, tests, build, migration, services, APK or commit ran; manual gates own the local commit and no push occurs.
