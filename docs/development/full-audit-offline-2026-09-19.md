# Offline acceptance repair — 2026-09-19

Scope: saved OFFLINE810/680/600/611/740/1440/1550/1070/722 failures from `artifacts/sdlc/1789752953639-97020/08-pnpm-android_test.log`. The handoff run1789760139774-98edc942-99ee-445a-b31e-fb270cec37af started2026-09-18T19:35:39.774Z;202 selected attempts completed against on-device handlers and web http://127.0.0.1:61142. It failed. Graph fixtures and CPI history belong to the parent repair and are outside this file's scope.

## Scope and acceptance

Repair the concrete saved failures without changing accounting, source admission, privacy or network boundaries. Retain stable case IDs. Author only; no tests, checks, formatting, builds, services or commits. Reuse task records RESEARCH-AUTO-002, GOAL-FEASIBILITY-001, MAPPED-IMPORT-001, BROKER-DIALECTS-001, ECB-FX-001, ECB-RATES-001 and EIA-BENCHMARKS-001. No private input is required for these saved-failure repairs.

- Calendar handler errors must distinguish missing retained edition404, invalid downloaded data503 and unsupported mutation405. The current broad catch catches `fail(404)` itself and converts it to503. Keep contract validation strict; place edition admission outside parse-error handling.
- OFFLINE1440 additionally expected a returned status although local handlers signal errors by throwing OfflineError. Use rejection assertions, retaining the exact status and explanation.
- OFFLINE810/680/740 expected visible text “On-device mode”; the snapshot shows an accessible complementary region with that name and visible wording “On this device”. Assert the actual named region without altering the zero-network assertions or packaged data checks.
- OFFLINE600 expected a sign-in heading after deletion. The actual account gate has an explanatory heading and a sign-in link. Assert that link, absence of private assessment UI, and actual private-read denial after reload.
- OFFLINE611/722 opened broker help but never selected the broker. The revised help intentionally shows only the selected broker's guidance. Select Zerodha/ICICI Direct before asserting the existing source/caution text.
- OFFLINE1070's saved accessibility snapshot contains Calendar source. Its implicit label wraps the options, while the accessibility name correctly identifies a combobox. Use the exact combobox role/name for selection, verify the selected value, and retain BLS isolation and zero-network checks.

Reusable prompt: inspect the saved artifacts above and current contracts/components, make the smallest production calendar error-boundary fix and fixture navigation corrections, preserve all rejection/provenance/reconciliation assertions, and record the exact user-run handoff. Do not run validation or change generated evidence.

## Authored result and handoff

Production changes are limited to `apps/web/src/offline/policy-calendar.ts` and `rbi-calendar.ts`: strict `safeParse` isolates malformed content from edition admission; missing captures retain404 and tampering retains503. Contracts, database schemas, source receipts and stored data are unchanged. Both calendar regression cases now also assert405 for POST. Browser fixture edits implement the navigation/accessible-name corrections above; OFFLINE600 additionally asserts401 from the actual local private assessment endpoint after deletion and reload, with no assessment panel and no API traffic.

Changed offline specs: `ecb-fx`, `ecb-rates`, `goal-feasibility`, `mapped-import`, `oil-benchmarks`, `policy-calendar`, `rbi-calendar`, `research-bls`, and `supplemental-holdings`. Existing data, export, cancellation, removal-consent, source-boundary and no-network assertions remain. No component styling or visual design was changed; manual keyboard/mobile review should confirm broker selection exposes only that broker's guidance and the deleted account shows its sign-in route. Parent owns task indexes, acceptance/catalogue reconciliation and other audit failures.

No dependencies or migrations changed. The user can run the following focused package validation after reviewing the combined working tree and running the desired SDLC gates:

```sh
pnpm sdlc "Repair saved offline acceptance failures" --checks-only
pnpm android:web
pnpm android:test --grep 'E2E-OFFLINE-(810|680|600|611|740|1440|1550|1070|722) '
```

The offline project uses the built on-device package; no API/database service is required for these selected cases. Use the offline launcher/preview URL printed by the command, with `/#research-calendar`, `/#my-goals`, `/#holdings`, `/#reference-fx`, `/#policy-rates`, and `/#oil-benchmarks` for manual review. Expected results are all nine cases passing, strict404/503/405 distinctions, deleted-account401, correct selected broker guidance, and zero network API requests. On failure provide the run ID, case/project, `artifacts/e2e/latest.md` and the matching error context/failed-stage log. These commands were not executed by the authoring agent. Local HEAD inspected: `8b5d817`; no new commit. Pre-existing generated validation/bug/task changes and concurrent sibling edits remain uncommitted and were not overwritten.

## Connected broker and WhatsApp continuation

Coordinated with the browser agent and took over its existing five-file repair: `tests/e2e/cases/browser/angel-connection.spec.ts`, `kite-connection.spec.ts`, `upstox-connection.spec.ts`, `whatsapp-channel.spec.ts`, and `whatsapp-schedule.spec.ts`. The browser agent retains scenario tests; the API agent retains WhatsApp backend/helpers. Saved evidence is `artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log`, with browser error contexts under `artifacts/e2e/2026-09-18T17-36-54-520Z-97709/results/`.

WEB1490/1420/1450 reached actual saved holdings but expected retired text “Holdings saved as revision1”. Their snapshots show Saved revision1 and the saved ISIN. The authored checks target that current revision status and the saved holdings region's exact instrument content, retaining authorization callback, preview, confirmation and revocation assertions. Static review found no further required broker edits.

WEB1600/1690's snapshots show a signed-out page: attempting to override Cookie in `route.continue` does not install the real session in the browser cookie jar. The authored fixtures install the actual registration session with `context.addCookies`, mapping only the host/security to the configured web origin while retaining the account-only path, HttpOnly and SameSite attributes. Existing app-fixture routing continues to forward real account requests to the isolated API. No mocked authorization or account gate bypass was introduced.

A downstream WEB1600 selector also needed correction: the outer WhatsApp main contains the recurring scheduler and therefore multiple checkboxes. Select the exact single-summary consent text from the current component, including the disconnect/STOP notice, and use the exact Reviewed public summary combobox name. Source identity, signed synthetic verification webhook, real queue/cancellation state, recurring consent reset/pause/resume/delete, reload and layout checks remain intact. No external WhatsApp message is sent. No production UI changes were needed for these five browser failures.

Manual connected validation after the API agent's backend/helper repair and combined gates: `pnpm sdlc "Repair connected broker and WhatsApp journeys" -- --grep 'E2E-WEB-(1420|1450|1490|1600|1690) '`. Expect desktop/mobile passes, actual saved revision and ISIN, authenticated WhatsApp pages, correct consent boundaries and queue/schedule lifecycle. Requires the usual migrated local databases and current API/web services at the origins printed by `pnpm dev`; UI routes are `/#holdings` and `/#whatsapp`. Dependencies and migrations unchanged. Report failing case/project, run ID and saved error context on failure. No execution or commit was performed; HEAD remains `8b5d817` at inspection. These fixes are authored, not verified.
