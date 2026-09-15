# Educational policy and action centre

ACTION-CENTRE-001 is the proposed-disposal educational policy child of DEV-019. All code/tests are authored; no execution or production acceptance is claimed.

## User workflow

From #action-centre, choose an actually owned saved holding and goal. Optionally attach a matching owned impact trace. Compare a quantity you propose disposing with doing nothing. Select an exact admitted published INR close or explicitly enter an assumed price/date. Enter total fees and total taxes, a plain-language basis note, cash/reserve/loss capacity, obligations/risk confirmations, cash-needed horizon, executable quantity/settlement assumptions, concentration/turnover budgets, declared prior turnover, last disposal date/cooldown, and downside stress. Personal financial defaults are not inferred. Basis-point inputs are explicitly explained (10,000 = 100%).

Review the side-by-side baseline and proposal, all ten policy constraints, exact assumptions, source receipts and uncertainty. Explicit storage consent saves an immutable reconstructible private receipt. A proposal with breached constraints can be retained for learning but never produces an instruction to transact. Retrying the same receipt ID returns the same result; changing its inputs is rejected. Deletion removes the payload and leaves a replay tombstone. Neither preview nor save changes holdings/goals/cash, records a trade, or schedules execution.

## Exact policy v1

All monetary operations use BigInt. Units have six decimal places; price supports eight INR decimal places. Gross proceeds = floor(units_scaled6 × price_scaled8 / 10^12) paise. Proportional disposed acquisition cost = floor(total holding cost × disposed units / total units). This is average cost for comparison, not tax-lot accounting. Remaining quantity/cost reconcile exactly with the original holding.

No-action goal projection is saved amount + monthly contribution × horizon, no growth. When explicitly checked, positive net hypothetical proceeds are added once to the goal projection. Fees/taxes above gross proceeds do not create goal savings; available cash includes their signed deficit. Goal gap is nonnegative target minus projection. Existing goal savings may already include investment wealth: users must avoid double-counting when explicitly earmarking proceeds; the tool cannot infer allocations.

Remaining cost concentration and disposed cost turnover use acquisition-cost denominators, explicitly not market value. Actual constraint comparisons use exact cross multiplication rather than rounded displayed basis points. Turnover includes declared previous disposed acquisition cost; comparisons themselves do not consume a trading budget. Stress loss = ceil(remaining cost × downside basis points / 10,000), compared with stated loss capacity. No expected return or probability is generated.

Ten guards: understanding risk; reviewed obligations; executable quantity; assumed settlement by cash-needed horizon; emergency cash reserve; acquisition-cost concentration; cost-based turnover budget; downside capacity; proceeds covering charges; cooldown since last declared disposal. False risk/obligation confirmations and a positive cooldown with no supplied last-disposal date produce needs-review. Breaches take precedence; otherwise contextual uncertainty, unverified price, zero cost denominator or a future/stale price (seven-day review window) produce needs-review. Within-assumptions is never advice.

Fee/tax totals are user assumptions with a mandatory note, not guessed legal rates. Settlement/liquidity limits are user assumptions, not exchange guarantees. This implementation therefore needs no tax-law provider call and does not infer a tax assessment. Actual market valuation, FIFO tax lots, optimisation or regulated suitability approval are outside this policy.

## Provenance, backend and storage

Strict shared schemas reject unknown external inputs. A published price must exactly match current admitted company edition ID/hash, effective date and close. Related equity editions are locked during re-admission. The complete company snapshot, original holdings/goal, optional trace, context warnings, explicit assumptions and final result are retained in app_action_centre (migration052). Result-schema validation recalculates the deterministic result and refuses mismatches. Policy version proposed-disposal-education-v1 is retained on every issued receipt.

Optional trace must belong to the current owner and selected holding/goal. Current reviewed event, source/identity admission, lineage and equity are rechecked; stale/conflicting evidence becomes visible review context, never a confident market action. Saved comparisons flag changed holdings/goals, deleted traces and unavailable source-bound prices when read. Historical receipts remain unchanged until the owner deletes them.

Account mutations serialize under the owner lock and recheck authentication after waits. Maximum 100 live assessments ensures complete bounded export/list; independent account IDs cannot access/delete another owner's receipt. Account deletion cascades receipts and tombstones. Privacy export includes actionCentre.assessments.

API: GET /api/v1/account/action-centre/choices; GET /api/v1/account/action-centre; PUT /api/v1/account/action-centre/:id; DELETE /api/v1/account/action-centre/:id. Same-ID changed-input reuse is409, replay after deletion410, another-owner delete404, stale owned bindings409. Content is private and no broker/provider credential reaches the browser.

## Web and Android

Shared responsive React screen includes prerequisites, native labelled form controls, explicit assumptions, source-price chooser, loading/error/retry, consent, save/reload/delete, original receipt expansion and connected navigation. Tables scroll inside their container on small phones. Native keyboard focus/44px controls and no gesture-only operation are required. Current APK requires rebuild/reinstall to receive this shared UI.

Offline handler uses locally owned holdings/goals/impact traces and admitted equity snapshot. It runs the same exact policy and reconstruction validation, retains records under localActionCentre, and supports owner export/delete and serialization through the existing gateway. No API, provider or LLM call occurs in local mode. Snapshot date is shown; there is no automatic synchronization of private comparisons.

## Tests and remaining parent scope

API990 tests exact receipt, replay/conflict, unchanged finances, privacy, ownership and deletion. API991 rejects impossible quantities/stale bindings/unavailable published prices and retains explicit guard breaches safely. WEB990 desktop/mobile exercises real local-service form→preview→consent→save→reload→delete/navigation. OFFLINE990 proves no-network persistence/replay/stale holdings/deletion. OFFLINE991 is a golden matrix for rounding, baseline, costs, liquidity, concentration, cumulative turnover, downside, cooldown and settlement.

Manual acceptance pending: keyboard/tab order; mobile landscape/large text/TalkBack; connected session expiry and network interruption; rebuilt APK offline reuse. No tests/builds/migrations run by the author.

DEV-019 remains partial beyond this concrete disposal-comparison policy: broader candidate-action catalogues, buy/rebalance alternatives, jurisdiction-specific actual taxes, live execution liquidity, actual trading-history budgets and production/regulatory suitability are not implemented here. Do not call a user-assumed educational comparison a validated recommendation engine.
