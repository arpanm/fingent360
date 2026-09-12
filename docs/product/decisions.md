# Accepted product decisions

Source: all nine available turns of “Market Analysis Review”, read on 2026-09-12, plus the revised 27-section blueprint. Later explicit user corrections resolve conflicts with earlier assistant proposals. Quoted market commentary and the assistant's market analysis are historical context, not validated market data or development commands.

| Area             | Accepted direction                                                                                                             | Implication                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Audience         | Indian beginner retail and affluent investors unfamiliar with planning                                                         | Plain language, progressive disclosure and sources                   |
| Core experience  | Five/six summary points, linked explanations, sectors → companies → holdings/goals                                             | Canonical linked event pages, not disconnected generated articles    |
| Company pages    | Fundamentals, source-linked news, relevant events, expandable impact reasoning                                                 | Shared instrument identity, evidence and causal edges                |
| Goals            | Multiple goals, including repeat goal types; editable defaults                                                                 | Separate goal instances from profile; disclose assumptions           |
| Goal examples    | Retirement, education, purchases, capital appreciation, geographic/sector learning, minimal-intervention monitoring            | Desired returns are inputs to feasibility analysis, never promises   |
| Portfolio        | Manual/virtual first; spreadsheet imports with platform help; integration later                                                | Reconciliation and parser versions before advice                     |
| Initial posture  | Educational first, regulated advice later                                                                                      | Advice activation is a separate gate; no trade execution             |
| Scope sequence   | Indian stocks; Indian funds/bonds; other Indian assets; international funds; international stocks; other global assets; crypto | Support long-term breadth without building every asset now           |
| Data             | Design free first, upgrade later; free/paid catalogue and priority tracker in the same plan                                    | Sections 10.6–10.10 remain the source of truth                       |
| Channel          | Responsive web/PWA now; WhatsApp and Android/iOS webview shells later                                                          | React foundation now; explicit PWA acceptance work remains           |
| Stack correction | React; Node/Java; PostgreSQL and MongoDB; no Temporal                                                                          | NestJS chosen for the initial API, Java only with a concrete benefit |
| Scale tools      | Redis, Kafka, Elasticsearch only later if needed                                                                               | Do not add these to initial deployment                               |
| Revenue          | Keep options open                                                                                                              | No billing model imposed at foundation stage                         |
| Delivery         | Capability/dependency gates, no day/week estimates                                                                             | Status is measured by acceptance evidence                            |

## Derived implementation choices for this setup

These are engineering choices made locally, not additional user requirements: pnpm monorepo; React with Vite; NestJS; Zod boundary validation; Node built-in tests; PostgreSQL/MongoDB readiness probes; loopback database ports 55432/57017 to coexist with this Mac's running services. Node 24 LTS is the CI baseline.

## First end-to-end slice

Oil shock → verified event → economic factor/sector/company mapping → uploaded Indian-equity portfolio → affected goals → educational No-action/Review result, with sources and uncertainty. A personalised Rebalance recommendation is gated behind the approved regulatory model. Build contracts and fixtures before this slice; do not seed it with the unverified numerical claims from the original newsletter.
