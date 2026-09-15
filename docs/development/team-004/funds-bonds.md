# FUNDS-BONDS-001 delivery

Status: NAV and owned comparison workflow authored, not executed. Full DEV022 remains partial: look-through, verified market bond sources, variable instrument conventions and production AMFI permission/live-format acceptance are not complete.

## Shared integration checklist

- Contracts export `funds-bonds.js`.
- API registers `FundsController`, `OpsFundsController`, `BondComparisonsController` and `fundsBondsProvider(config)` from `funds-bonds.ts`.
- Register `055_funds_bonds.sql` in app and isolated E2E fixture migration lists. Account deletion uses its FK cascade.
- Web route `#funds-bonds` renders public `FundsBonds`; do not account-gate the whole reader. Its `BondComparisonWorkbench` manages private API sign-in errors; optional direct private route can account-gate that component.
- Operations renders `FundsBondsOperations({request?,onDenied?})`; both props optional. Scoped source import JSON limit may be10MB; actual uploaded/downloaded file max4MB. Do not enlarge unrelated routes.
- Register offline `handleFundsBonds`; add `OfflineBundle.fundsBonds?:unknown`; snapshot builder stores the exact `GET /funds/snapshot` response. It now requires `capturedAt,funds,totalSchemeCount,truncated`. Missing snapshot defaults explicitly to empty0/nontruncated.
- Privacy API calls `exportBondComparisons(client,userId)`, contract property `bondComparisons:BondComparisonsSchema` (default `{comparisons:[]}` for older exports). Device privacy calls `exportLocalBondComparisons(state,userId)` and deletes `localBondComparisons[userId]` with account deletion. Removed device receipts retain a hash, not serialized personal inputs.

## Authored acceptance

| Cases              | Scope                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API1080            | Real isolated Mongo/PostgreSQL NAV ingestion, exact/null values, retained text, public history, snapshot and withdrawal.                                               |
| API1081            | Exact private comparison, replay/conflict, cross-account refusal, export and durable deletion.                                                                         |
| API1082            | Missing written permission/malformed source cannot publish.                                                                                                            |
| WEB1080            | Actual NAV list/detail/source, unavailable look-through, keyboard Back, mobile bounds.                                                                                 |
| WEB1081            | Rupee/percentage form, review, save, reload and remove private comparison through actual API.                                                                          |
| OFFLINE1080        | Packaged bounded NAV snapshot with zero API network.                                                                                                                   |
| OFFLINE1081        | Actual on-device account/comparison creation, persistence across reload and deletion/replay rejection.                                                                 |
| Six contract tests | NAV precision/variant identity, malformed/duplicate source, exact comparison golden,10% conventional XIRR, no-root/non-conventional series and invalid date intervals. |

All provider-shaped/financial fixtures are visibly synthetic. No source fetch or app request occurs during test discovery. Keyboard focus, TalkBack, mobile visual quality, physical-device installation and actual permitted AMFI file acceptance remain separately unverified. Test authorship does not establish passing results.

## Manual next actions

No package dependencies changed. PostgreSQL and MongoDB are required. Apply additive migration using `pnpm db:migrate`, restart your app with `pnpm dev`, and use the printed app URL at `/#funds-bonds` and Operations → Funds/NAV. Do not capture AMFI data until actual written permission is available for this deployment.

Run `pnpm sdlc "Add NAV evidence and owned bond comparisons" -- --grep FUNDS-BONDS-001`. That user-invoked command owns format/check, gated commit and affected API/desktop/mobile E2E. It stages all nonignored concurrent changes; review scope first. For only gates/commit use `pnpm sdlc "Add NAV evidence and owned bond comparisons" --checks-only`.

For device acceptance run `pnpm android:snapshot`, `pnpm android:web`, `pnpm android:test -- --grep FUNDS-BONDS-001`; then `pnpm android:build` and reinstall for physical-device feedback. Keep test UI watch toggles off.

Expected: reviewed NAVs preserve their original decimal/date/identity distinctions; withdrawn NAVs disappear from connected reads and new snapshots. Exact synthetic comparison outlay105072paise and deposit maturity108634paise reconstruct from its saved inputs. Private receipts remain isolated, exportable and deletable online/offline. Report failure case/project and the saved error-context/report path, with no secrets or actual holdings.

No deterministic execution, dependency install, migration, provider ingestion, service operation, test run, commit or push was performed by the agent. Last inspected HEAD was `efd28d3`; other team edits were preserved and all new files await user gates. See the product spec for current source access evidence and pending work rather than marking DEV022 complete.
