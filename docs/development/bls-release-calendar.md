# BLS release calendar — RESEARCH-AUTO-002

Authored end to end; deterministic gates and live worker acceptance are not run. No dependencies were added. Other calendars and original numerical publication vintages remain pending.

## Researched input and scope

On 2026-09-15, the [official subscription page](https://www.bls.gov/help/hlpical.htm) identified the [BLS calendar](https://www.bls.gov/schedule/news_release/bls.ics). [Copyright guidance](https://www.bls.gov/bls/linksite.htm) permits reuse of BLS public-domain publications with source attribution; its photo/illustration exceptions and trademarked emblem are excluded from this text-calendar implementation. This research answers the source-access question without asking the user to discover terms. No licence acceptance, accounts, paid services or messages were performed.

A read-only source-format request returned HTTP200, text/calendar, 80,672 bytes and313 events. The exact bytes and SHA256 are retained as `packages/contracts/test/fixtures/bls-calendar-official.ics` and its provenance JSON, dated2026-09-15. This fixture is actual source-format evidence, not an application seed, current schedule guarantee or numerical vintage. A default Python user agent returned403; an identified research user agent succeeded. Production capture uses an identified Fingent360 calendar-reader user agent and reports source failures. It does not bypass an access denial, substitute scraped third-party data or synthesize schedules.

## Parser and storage

The observed ICS declares `US-Eastern` with an explicit VTIMEZONE: daylight begins on the second Sunday in March at02:00, standard time begins on the first Sunday in November at02:00, from2007. The parser requires that exact supported timezone definition and observed event property set. It translates wall times using America/New_York and verifies exactly one candidate offset matches. Ambiguous fall-back times, nonexistent spring-forward times, invalid dates, unknown timezone definitions and unhandled recurrence/properties and tentative event status fail the capture. Tentative releases are not silently presented as confirmed schedules. No naive constant UTC offset is used. UID, source sequence, cancellation and title survive conversion; scheduled times are displayed in the reader's local zone.

Migration062 adds `source_id` to immutable calendar editions with a BEA default for existing records. BLS raw-document hashes include the official URL to separate source identity; BEA hashes stay unchanged for compatibility. MongoDB retains raw capture bodies before parsing, PostgreSQL retains only validated immutable calendar projections, and the existing research-run receipt records capture success/failure. Repeated identical captures reuse their retained edition; a changed schedule produces a new edition. Failed fetch/parse keeps the last valid edition. History is bounded to the latest100 retained captures in the picker; a known older retained edition remains addressable by its source and hash. Captured schedule history is not original numerical data vintages.

The existing scheduled research worker now includes `bls-calendar`, defaults to six-hour checks and supports the current pause/interval controls under Operations → Automatic research. Source capture does not publish invented news stories or numerical observations.

## Reader workflow and Android

Open `/#research-calendar`, choose BEA or BLS, choose latest or retained capture and upcoming/all periods, and follow the official attributed calendar link. Switching source clears the prior source's edition selection. Loading/error/retry states hide stale calendar content. A release date never establishes that the release actually occurred.

Connected Android uses the same React and API code. Offline snapshots add a source-keyed `researchCalendars` collection while retaining legacy `researchCalendar` for BEA compatibility. Only downloaded current capture bodies can be selected offline; older server history does not masquerade as downloaded. Old APK bundles show a truthful missing BLS snapshot. Rebuild/repackage via the existing manual Android workflow to include changes; an installed offline APK does not update itself.

## User-run acceptance

- Apply `pnpm db:migrate` with the configured local PostgreSQL/MongoDB services; no install step is needed.
- Run `pnpm sdlc "Add researched BLS release calendar" --checks-only` for formatting/checks/gated commit.
- Run `pnpm e2e:run --grep @BLS-CALENDAR-001` for API1070, desktop/mobile WEB1070 and OFFLINE1070.
- Parser unit cases in the normal check gate cover retained real fixture integrity, winter/summer UTC conversion, daylight-saving gaps/overlaps, invalid dates, unsupported fields and cancellation.
- API/web cases use labelled synthetic revisions stored in the actual owned test database. They check per-source history isolation, older revision replay, source switching, attribution and unavailable retry. They do not claim to validate a live BLS capture, which requires the user enabling/running the connected worker and observing its saved receipt.
- Use the actual URL printed by `pnpm dev`; open `/#research-calendar` and Operations → Automatic research. Leave watch/eye toggles off. For a failure send its saved run directory, case/project, error-context and expected-versus-actual result.

No agent-run tests, format, check, build, migration, service, provider ingestion job, commit or push occurred. Read-only primary-source research is the only external data access performed for this task. Restore/load/security/device acceptance is unaffected.
