# Task-input research — 2026-09-15

This is an initial primary-source check to assign research ownership, not a completed legal opinion, a provider licence, or verified parser specification. No provider was activated or contacted, and no private account was opened.

## Existing user answers carried forward

- **Research owner:** the latest user request says the agent should work out regulations, source usage and formats using research, rather than asking the user to interpret them.
- **Priority and spending:** earlier request says free sources first. No paid subscription or legal engagement is authorized by this triage.
- **Broker choice/order:** earlier answer says do all five and choose the order. Working order chosen by the agent: Zerodha, Angel One, Groww, Upstox, ICICI Direct. This is an execution choice, not a new user answer.
- **AI:** earlier answer explicitly requests configurable OpenAI, Gemini and Anthropic, with query-based suggestions if no provider is configured. No new provider-choice question is needed; availability of actual credentials is not established here.
- **Runtime:** existing request starts with an offline Android test build and later CDN/API hosting. Keep that scope; do not block current authoring on choosing a cloud vendor or public commercial deployment.
- **Execution:** the user owns deterministic gates/tests through pnpm sdlc. This triage does not change that boundary.

## Source rights and regulatory research

NSE’s published policy distinguishes access from permitted use and redistribution, with the relevant agreement defining the allowed scope. Therefore public availability is not treated as a redistribution licence. Next: identify the specific datasets, display/cache/offline needs and applicable terms, then prefer permitted free alternatives where possible. This research can proceed without asking the user to understand the policy. Any later agreement, spending or external contact requires a concrete separate decision. [NSE policy](https://www.nseindia.com/static/market-data/nse-data-policy).

AMFI’s official search result describes site access for personal, non-commercial use. The full terms page could not be opened in this research pass, so this is only a lead: re-read the complete current terms and identify the specific NAV endpoint rights before treating any permission requirement as resolved. Keep permitted fixture/parser development separate from live activation. Do not assert that the user possesses written permission. [AMFI terms](https://www.amfiindia.com/terms-of-use).

SEBI’s current regulation index links the Investment Advisers and Research Analysts regulations with amendments through November 25, 2025. The agent should prepare a feature-by-feature applicability brief from the actual linked regulations and current circulars; calling an app educational is not by itself a completed classification. The existing research/education scope and disabled regulated-advice gate remain unchanged. Research can start now; regulated activation is not approved by this triage. [SEBI regulation index](https://sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=2&smid=0&ssid=3).

## Broker-format evidence and next research

- **Zerodha:** official support documents an XLSX holdings download and date selection. It does not, by itself, establish a complete versioned workbook layout or acquisition-cost reconciliation. Inspect the official examples/linked report documentation before writing the named parser. [Holdings report](https://support.zerodha.com/category/console/portfolio/console-holdings/articles/holding-report).
- **Angel One:** the official reports page lists holding statements; official portfolio guidance mentions masked portfolio downloads. Research the actual export schema and masked-sample suitability next. [Reports](https://www.angelone.in/spark-reports/), [portfolio guide](https://www.angelone.in/knowledge-center/user-manual/portfolio).
- **Groww:** official stock support is a starting point; the complete named export schema remains unverified. [Stock help](https://groww.in/help/stocks).
- **Upstox:** portfolio report support and the documented holdings API are available research leads. An API response is not proof of a spreadsheet export layout. [Report support](https://upstox.com/help-center/my-account/portfolio-reports/), [holdings API](https://upstox.com/developer/api-documentation/get-holdings/).
- **ICICI Direct:** the official FAQ explains accessing holdings. It does not establish cost-basis or full export-column semantics. Do not substitute a global-investment report for the Indian-equity export. [Holdings FAQ](https://www.icicidirect.com/faqs/my-account/how-can-i-check-the-shares-held-in-my-demataccount).

No complete broker parser was implemented or verified here. Exhaust public official material first. Only if the remaining layout is available exclusively in an account should the agent ask for the specific redacted headers/example needed, explaining why. Do not ask for passwords, PAN, account identifiers or actual portfolio amounts. No such sample/access request is necessary for the next research step.

## Validation evidence observed once

The saved E2E handoff read during triage was run `1789450221458-4d30c5af-f9f6-45f3-84f1-a0a696ae88f1`, started `2026-09-15T05:30:21.458Z`, marked running: 823 selected and 494 attempts completed at that read, API4103/web5175. It already contained failures, including API120. This is an incomplete snapshot, not a final result. Do not start another suite or promote validation-pending tasks based on the commit alone. On later pickup, read the completed saved report once and map failures to their owning tasks; do not infer that unrelated tasks passed.

## Questions now versus later

No new answer is required to start the independent ready/research tasks. Existing session answers resolve the current scope. Questions are deferred until there is a concrete need: unavailable account-only sample, an actual provider agreement/payment, a regulated-launch operating model, a specific deployment account, or phone/test evidence. These are future triggers, not unanswered questionnaires or assumed approvals. Record any future question, exact user answer, date, affected tasks and resulting scope change in each task’s input record.
