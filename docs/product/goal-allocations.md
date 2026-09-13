# Goal allocations — ALLOCATIONS-001

## Outcome and scope

An account owner can earmark quantities of their manually recorded holdings for one or more saved goals. The complete workflow is choose goal and holding → enter quantity → review the whole plan → explicitly save → reload/edit/history. It is a record of the owner’s intention, not a recommendation, trade, transfer or valuation. The fictional Learning lab stays separate.

## Exact units and reconciliation

Quantities support six decimal places. Calculation converts quantity text to integer millionths; it never uses floating-point portfolio arithmetic. For each allocation, attributed recorded cost is `floor(holding total acquisition paise × allocated millionths ÷ owned millionths)`. Each allocation is rounded down independently; undistributed rounding paise remain unallocated. The UI labels this as recorded cost, never current market value, and does not add it to the goal’s saved amount or contribution projection. Goal saved amount, future monthly contributions and nominal no-growth gap remain separately visible.

One plan contains at most 200 unique goal/ISIN pairs. Across all goals, allocated quantity of an ISIN cannot exceed its current owned quantity. Duplicate pairs, zero/invalid quantities, unknown holdings, another account’s goals and deleted goals are rejected. Saving requires explicit storage consent and expected allocation, holdings and referenced goal versions. Concurrent writes serialize under the same account lock as holdings confirmation and goal changes; the second stale save conflicts rather than double allocating.

## History and changes

Every successful replacement creates an immutable revision, including clearing all allocations. Current plan state derives from the latest revision plus current owned goals/holdings. Any holdings revision change requires review; removed/reduced holdings and changed/deleted goals show explicit reasons. Historical rows retain goal names, quantities, input versions and recorded costs. They are never silently deleted or proportionally resized. The owner must review, adjust/remove invalid rows and save a new revision against current versions. Account deletion cascades allocation history, and privacy export includes all owned revisions. Offline uses the same contracts, exact calculations and review rules with the existing atomic local transaction layer.

## Acceptance and operations

API tests cover empty state, exact fractional allocation/rounding, ownership, combined oversubscription, stale/concurrent saves, lifecycle review and retained history. Browser tests exercise real entered holdings/goals, guided selection/review/save and reload; offline cases exercise matching contracts and durable revisions. No scheduler is needed: this is an explicit user action and review flags derive on each read. API requires additive migration017; Android must rebuild with the new offline handler. Implementation and test execution status are recorded separately in root TODO/status; this specification does not claim a test pass.

## Implemented entry points and authored cases

`#allocations` provides the connected editor/review/save/history UI, reached from saved Goals and Holdings. The saved-holdings table also provides a separate “Look up identity” link to `#securities/:ISIN`; this does not assert an unknown security’s identity or alter quantity/cost. Guest sign-in returns directly to allocations. Stale saves preserve the draft and instruct the owner to cancel/reload/review; successful saves use the returned state immediately rather than depending on a second GET acknowledgment.

API200 covers exact pro-rata cost, unknown ownership, oversubscription, competing same-version saves, reduced holdings, stale rejection and immutable history. API201 covers split allocations across repeated goals, another account, removed goals and privacy export. WEB200 covers the guided real API flow and reload/history using a fresh isolated app fixture. OFFLINE240 covers the same full editor and persisted local flow. No test/build/migration was run by this implementation subtask; parent integration records gate results separately.
