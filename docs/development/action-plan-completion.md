# Purchase, FIFO and rebalance comparison implementation

The action centre now offers the original average-cost disposal, a reconciled FIFO disposal, a purchase of an existing holding and a two-security rebalance. All four use actual owner holdings/goal revisions and preserve the original no-action baseline. This is an educational comparison of a proposal supplied by the user; it does not select securities, place orders or change saved finances.

## Data and calculations

New input.plan is optional for backward compatibility. New receipts use proposed-trades-education-v2; old receipts keep proposed-disposal-education-v1 and their original arithmetic. Existing migration052 JSON receipt storage, account deletion/export and offline localActionCentre are reused. No separate migration or dependency is needed for the plan extension.

FIFO requires all open acquisition lots to reconcile exactly to saved quantity and cost. Each has acquisition date, explicit within-day sequence, unique reference, open units and open cost. Dates cannot be after the comparison date. The system consumes oldest lots first; partial lots retain their rounding residual in remaining cost. Allocated gross proceeds sum exactly to total proceeds. The recorded gain is gross proceeds minus open acquisition cost, before disposal fee and tax adjustments. Inputs are user-attested records with a retained evidence note, not a fabricated broker feed.

Purchase adds units and consideration cost, deducting consideration plus explicit combined fees/taxes from available cash. It never increases the goal projection merely because an investment was purchased. Rebalance removes the FIFO source position and adds the separately specified target purchase; proceeds are assumed settled, never implicit margin credit. Costs cannot be silently funded by an imaginary sale. All other saved positions remain present, and the maximum cost-based concentration and portfolio-wide downside stress consider them all. Turnover counts both transaction legs and declared prior turnover; displayed turnover can exceed100 percent.

The user can choose a currently released research policy. The API re-admits the exact version and its reviewed source event, applies stricter concentration/turnover caps and minimum cooldown/stress tests, and retains the full immutable policy alongside the calculation. Expired/withdrawn/changed policies cannot issue new bound comparisons. Saved receipts are retained with visible review reasons. Offline accepts only a downloaded, admitted unexpired policy and clearly cannot establish newer server withdrawals.

## Tax research and limits

The Income Tax Department's [capital gain overview](https://www.incometaxindia.gov.in/w/capital-gain) describes FIFO for dematerialized securities and adjustments such as grandfathering. The [sale-of-shares guidance](https://www.incometaxindia.gov.in/en/sale-of-shares) describes the relevant holding-period classification. Those rules do not supply a user's complete transaction history, residency, STT eligibility, other gains/losses or surcharge facts. Open lots must already reflect previous disposals/corporate actions and applicable cost adjustments; explicit tax and fee totals remain labelled assumptions. A gross FIFO gain is not a complete tax-return liability. No legal/tax rate is guessed.

## UX and privacy

Choose Comparison type on Explore a change. Rebalance/FIFO adds an ordered acquisition-lot editor, Add/remove controls and mandatory evidence explanation. Rebalance adds target ISIN/units/price/date. The review includes allocated lots, exact proposed positions, purchase/sale amounts, cash, constraints and no-action goal comparison. Existing consent, uncertain save replay, original receipt, reload, delete and Back navigation remain. Shared web code serves connected and packaged Android; rebuild/reinstall is required to update an installed APK.

## Authored tests and manual action

API1280 checks actual storage/replay/export/owner isolation/deletion and unchanged finances for all three new modes. API1281 rejects inconsistent, duplicate/future lots and retains an unfunded purchase as constraints-breached. WEB1280 covers real form→lot/purchase review→consent→save→reload→delete/Back on desktop/mobile. OFFLINE1280 checks identical local results/replay with network disabled. Contract goldens cover exact full/partial lots, same-day ordering, cash conservation, no fictitious goal savings and refusal. Existing990–991 cases retain legacy compatibility; governance cases cover release binding.

User command after configured DB/API/web are available:

```sh
pnpm sdlc "Complete proposal comparison workflows" -- --grep 'E2E-(API|WEB|OFFLINE)-(990|991|1280|1281)\b|DEV-015'
```

Governance migration064 must be applied through the normal manual migration workflow before new policy choices are loaded. Use the web URL printed by pnpm dev, route #action-centre. Leave watch/eye off. Report first failed stage/ID/project and saved error path, without private lots or keys. No format/check/test/build/migration/commit was run by the author.

## Private receipt storage

Migration067 adds authenticated encrypted receipt envelopes and stable content digests. New comparisons store no plaintext payload. Owner list/export/replay upgrades legacy plaintext transactionally and rewraps old-key envelopes; the digest and receipt reconstruction reject changed content and cross-receipt ciphertext. The trigger permits encryption maintenance without changing IDs, timestamps or original request fingerprint, plus explicit deletion. Deletion removes both plaintext and ciphertext; account deletion still cascades. Old plaintext rows remain until owner access; old backups are not rewritten.

Server `PRIVATE_DATA_KEYS` and `PRIVATE_DATA_ACTIVE_KEY` must be configured before new comparisons or legacy upgrades. Offline private records continue their existing device-storage policy, not server-key encryption; no server key is packaged. API1282 authors actual stored ciphertext, cross-receipt rejection/recovery and deletion. No migration or test was run.

## Restricted tax policy and materiality

The optional resident-listed-equity-no-surcharge-2024-v1 policy now calculates eligible FIFO disposal tax from retained acquisition dates/costs, allocated deductible fees and declared prior annual eligible long-term gains. It uses20 percent short-term and12.5 percent long-term rates, the remaining INR1.25 lakh annual long-term threshold, and4 percent cess. Calculations round up to paise for comparison; final return rounding is not claimed. [Income Tax Department individual computation](https://www.incometaxindia.gov.in/w/computation-of-tax-for-individual-1) and [2026 memorandum](https://www.incometaxindia.gov.in/documents/81799/11848482/memo-2026.pdf/fe530cfa-9c49-fc5c-4bfa-fc96fd5e7b7a?t=1770008674037) are the dated rate references. [Share-sale guidance](https://www.incometaxindia.gov.in/en/sale-of-shares) excludes STT from deductible transfer expenses.

The UI requires affirmative eligibility, total taxable income including these/prior gains, prior eligible long-term gains and deductible disposal fees. It refuses nonresident/business/STT-ineligible cases, unexhausted basic exemption, losses/special relief, income above INR50 lakh, pre-February2018 lots and dates outside the supported policy window. These use the existing explicitly reviewed tax-input path instead; the tool does not silently assign them the restricted rates. No universal tax-return or regulated-suitability claim is made. Rules require review after March2027; future policy changes need a new version, not mutation of receipts.

An explicit minimum absolute cash change supplies a materiality guard for comparison size. It never labels a large cash movement as profit or a recommended action. API/WEB/OFFLINE1283 and exact tax unit cases cover retained policy, funding, annual threshold,12-month boundary and refused unsupported eligibility. API1282 covers encrypted storage. All remain unrun.
