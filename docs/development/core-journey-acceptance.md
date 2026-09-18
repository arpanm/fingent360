# Core functional journey acceptance — 2026-09-17

The user-run SDLC1789668919723-57996 passed eight selected cases at commit `bee7f02`: API1520/1860 and WEB930/990/1590 on desktop/mobile. This verifies those selections, not every related story. Goals already has its recorded accepted scope. This next batch completes authoring of the following repairs; execution remains manual.

| Story                        | Completed implementation in this batch                                                                                                                                                                                       | Acceptance still required                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| IMPACT-TRACE-001             | Stable event/sector/company/goal/context selection; busy-state protection; failed evidence retry without an old saveable preview; fresh consent after changes; review focus; diagnostic holding selection and consent reset  | 24 reviewed API/browser/offline case/project combinations, including WEB961                              |
| DEV-006                      | Failed brief-list re-admission removes old “currently admitted” cards; retry restores current results and connected detail navigation                                                                                        | Seven reviewed API/browser/offline combinations, including independent issue/correction/withdrawal       |
| ACTION-CENTRE-001            | Stable selectors through sell, purchase, FIFO rebalance, supported tax mode, price basis and released policy; policy choice locked during work                                                                               | 16 reviewed API/browser/offline combinations; financial calculations unchanged                           |
| REPORTS-001                  | Scheduler storage failure no longer prevents already captured reports from being prepared; existing sequential tick, pause checks and leases remain                                                                          | 22 reviewed combinations, including real isolated storage-fault API227 and saved report-browser failures |
| READING-FOLLOW-001 / DEV-029 | Exact Federal Reserve Board test selection, actual saved subscription/reload assertions; public-share cancellation/denial and canonical copy fallback acceptance; one safe GET transport retry in the synthetic-host fixture | WEB444/1255 desktop/mobile; no product change or live external message                                   |

Web and Android reuse the changed React components. Existing API contracts, encrypted records, source receipts and database models are reused; no dependency or migration was added. Report preparation changes run on the server; offline reports already use the local handler. Android device installation/certification remains separate from the offline browser project.

## Run after this authoring batch

Use the existing migrated PostgreSQL/MongoDB and current API/web services. The last recorded app origin was http://127.0.0.1:5176; use the URL printed by your current development session. No new key setup is required.

Run these commands in order. Each story command owns format/check, the gated local commit, its connected acceptance and rebuilt offline acceptance. It records failures and only certifies the reviewed functional scope when the full current matrix passes. Live source/editorial permission, hosting, provider credentials and native release certification are separate release requirements, not implied by a test pass.

```bash
pnpm sdlc "Complete evidence-to-portfolio traces" --story IMPACT-TRACE-001
pnpm sdlc "Complete reviewed public briefs" --story DEV-006
pnpm sdlc "Complete educational action comparisons" --story ACTION-CENTRE-001
pnpm sdlc "Complete saved research reports" --story REPORTS-001
pnpm sdlc "Complete reading follow and share recovery" -- --project=desktop --project=mobile --grep 'E2E-WEB-(444|1255)\b'
```

Remaining source-form checks from the earlier authoring batch, beyond the eight selections already passed:

```bash
pnpm sdlc "Validate remaining source publishing journeys" -- --grep 'E2E-(API-(147[01]|186[1-6])|WEB-(615|725|1472|159[1-6]|1990|2000))\b'
```

User checks: open `/#impact-traces`, `/#intelligence-briefs`, `/#action-centre`, `/#reports`, reading preferences and a public reading item. Expect real owned records, current source admission, save/reload/delete, exact no-action comparisons and explicit failure/retry states. Test figures and induced faults stay labelled synthetic; they do not become live content.

For a failure, supply the case/project, saved run path and assertion from `artifacts/e2e/latest.md` or the SDLC handoff. No agent-run validation, service operation or commit was performed. Existing unrelated/generated changes were preserved. The manifest is a complete required case list for each stated functional scope; an authored test, partial run or skipped case does not close it.

## September18 run follow-up

Saved run review: portfolio1789709592634-72179 has18 passing connected results after exact API retries, with WEB1702 still failing on both browser projects; its offline stage was not reached. Brief1789711405725-75316 records all seven required results passing after its repairs, but overall acceptance remains stale across revisions. Source1789722425545-83879 records28 passing results, with WEB1593 failing on both browser projects. These counts describe saved evidence, not newly executed checks.

Fixes: all six Research governance selectors now have explicit accessible labels; WEB1702 forwards its public event reads to the same actual isolated API as its Operations mutations, then asserts the exact available event. WEB1593 retains actual event readiness and now checks exact sector/company/direction labels through the same complete workflow. No timeout increase, API permission relaxation, dependency or migration was added in this follow-up.

Smallest diagnostic run (four browser combinations only):

```bash
pnpm sdlc "Repair governance event selection" -- --project=desktop --project=mobile --grep 'E2E-WEB-(1593|1702)\b'
```

To close the two story matrices after repair, use the existing `--story IMPACT-TRACE-001` and `--story DEV-006` commands above. For the failed source scope, only WEB1593 needs a new selected browser rerun; the other28 saved selections passed. Existing PostgreSQL/MongoDB/API/web setup is sufficient; open the printed app URL → Operations → Research policies and causal review. Expected: actual reviewed event selectable, source citations/sector/company loaded, saved catalog binding and independent release/withdrawal. Report case/project and run path on failure. Generated bug and validation statuses remain owned by the manual SDLC command.
