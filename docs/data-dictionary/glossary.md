# Product glossary — DEV-001

| Term                                      | Plain-language meaning                                                                | Must not be confused with                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Instrument                                | An identifiable investment/security                                                   | Issuer (company) or exchange listing                               |
| Listing                                   | Instrument's tradable exchange/symbol record during a validity period                 | Permanent instrument identity                                      |
| ISIN                                      | Security identifier used in matching                                                  | A user account or an exchange-specific ticker                      |
| Evidence                                  | Exact source/version/location supporting or contradicting a claim                     | A link that merely discusses the topic                             |
| Observation                               | A dated, unit-bearing numerical fact from a source                                    | Generated narrative or an unsupported estimate                     |
| Vintage / revision                        | The version of a published observation known at a particular time                     | Latest value retroactively available in the past                   |
| Event                                     | A classified market-relevant development                                              | Proof that any security must be bought/sold                        |
| Economic factor                           | Transmission channel such as input costs, rates or currency                           | A company or a directly measured portfolio loss                    |
| Causal edge                               | Reviewed explanation linking event/factor/sector/company                              | Correlation presented as certainty                                 |
| Exposure                                  | Value of holdings connected to a factor/event                                         | Predicted loss, profit or recommended sale amount                  |
| Position                                  | Quantity/value of an instrument in a snapshot/account                                 | Tax lot or transaction history                                     |
| Tax lot                                   | Units with a shared acquisition/cost history                                          | A fabricated cost estimate for an incomplete import                |
| Reconciliation                            | Comparing imported/calculated values against source totals under a stated rule        | Assuming an upload is correct because parsing succeeded            |
| Risk capacity                             | Ability to bear loss given finances and horizon                                       | Emotional risk tolerance                                           |
| Risk tolerance                            | Willingness/reaction to uncertainty and losses                                        | Evidence of capacity or regulatory eligibility                     |
| Goal allocation                           | Share of a position/cash bucket earmarked for a goal                                  | Additional capital or a trade instruction                          |
| Funded ratio                              | Allocated current value divided by the defined target                                 | Probability the goal will succeed                                  |
| Fact / expectation / scenario / inference | Observed event / sourced consensus / hypothetical situation / reasoned interpretation | Four interchangeable labels for certainty                          |
| Current / stale / unknown                 | Availability relative to a specific freshness rule/time                               | Source authority or numerical accuracy                             |
| No review trigger                         | No rule triggered for the evaluated inputs and policy                                 | Guarantee of safety, “hold” advice or complete review of all risks |
| Unable to assess                          | Required information/policy is unavailable or invalid                                 | No risk or no action required                                      |
| Percentage points                         | Absolute difference between two percentages                                           | Relative percentage change                                         |
| EOD                                       | End-of-day data for a defined market session                                          | Real-time data or simply the latest retrieved document             |
| Corporate action                          | Issuer event affecting securities/entitlements/units                                  | A normal user buy/sell transaction                                 |
| XIRR                                      | Annualized return using dated cash flows                                              | Simple price return; requires a separately specified calculation   |
| Provenance                                | Record of where a value came from and how it changed                                  | A model's confidence score                                         |

## Current saved-record terminology

- **Recorded acquisition cost:** the user's entered purchase-cost total. It is not a live price, present market value, profit or return.
- **Contribution-only projection:** entered savings plus monthly contribution multiplied by the entered horizon; no market growth, inflation, fees or taxes are assumed. A remaining gap is not a risk probability.
- **Saved allocation:** exact quantities assigned to a goal, with allocated recorded cost disclosed separately. Allocation does not create cash or add to entered savings.
- **Research connection:** the user's explicitly chosen source edition, owned target and personal reason. It does not establish causation or verified financial exposure.
- **Public-state edition:** a reviewed publication or withdrawal. A withdrawn predecessor is not described as a previously published article merely because it is retained for operator review.
- **Historical receipt:** evidence of what a request saved or observed at its recorded time. Replaying it is not a fresh reading of current heads, permissions or publication state.
- **Issued report:** an immutable captured-record review. Comparing reports does not rewrite either original and does not calculate investment performance.
- **On-device workspace:** separately persisted local accounts and records. It is not server synchronization, encrypted cloud backup or knowledge of changes after the bundle capture date.
- **Quarantine revalidation:** parsing a verified linked retained response using a recorded parser version, without fetching a provider or publishing the candidate. Unlinked legacy blobs are not inferred ingestion attempts.

Risk capacity, risk tolerance, funded ratios based on market value, lots and causal event edges elsewhere in this glossary define concepts; they do not claim those assessments/data models are implemented. Use the [threat model and vocabulary gates](../product/threat-model.md) when explaining confidence, advice and missing evidence.
