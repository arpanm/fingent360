# Source-backed learning and contextual reading

SOURCES-002 connects three existing experiences to published research without treating a fictional exercise or user-entered finances as market facts.

`learning-content.ts` is the shared authored catalogue and grading rubric used by API and offline learning. Existing ISIN, reconciliation and learning-interest question IDs, answer keys, source revision and persisted attempt shapes are preserved. New diversification, inflation, data-revision, basis-point and trade-balance questions have their own stable IDs. Answers and voluntary poll votes use the existing owned persistence, consent, idempotency, export and deletion workflow. Supplemental citations are separate context metadata and do not rewrite historical answer payloads.

Primary references checked while authoring (conceptual summaries are original, with no copied current market figures):

- [BEA GDP revisions](https://www.bea.gov/news/blog/2016-06-29/why-do-old-gdp-numbers-keep-changing), [BEA trade statistics](https://www.bea.gov/data/intl-trade-investment/international-trade-goods-and-services) and [Federal Reserve rate-change units](https://www.federalreserve.gov/monetarypolicy/openmarket.htm): interpreting periods, editions and units.
- [NSDL depository FAQs](https://investor.nsdl.com/portal/en/kb/articles/faqs-on-depository-system): ISIN identifies a security.
- [Investor.gov asset allocation and diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation): spreading investments helps manage risk, without guaranteeing returns.
- [ECB inflation explainer](https://www.ecb.europa.eu/ecb-and-you/explainers/tell-me-more/html/what_is_inflation.en.html): price-index concepts and different baskets. This historical conceptual reference is not a current inflation observation.
- [Investor.gov investment products](https://www.investor.gov/introduction-investing/investing-basics/investment-products) and [introduction to investing](https://www.investor.gov/introduction-investing): broader educational reading. The CSV reconciliation workflow is explicitly our record-checking rule rather than a claim that a source validates imported ownership.

An explicit `#learning?question=ID` link focuses the matching question and expands its source context without changing initial plain-page tab order. Each question exposes source context and related published reading. `ResearchLinks` validates the feed response, displays source and dates, links to the normal reader and filtered Explore, and distinguishes loading, unavailable and genuinely empty results. It requests only a broad public topic and never sends saved goal names, values or holdings to a provider. Existing reader workflows supply evidence, saving, reminders and return navigation.

Overview maps a saved goal or followed CPI indicator to inflation, a followed GDP indicator to growth, and an empty workspace to investing basics. The reason is visible. This is educational topic matching, not security exposure, valuation, suitability or return forecasting. The learning lab shows a separate real-research bridge while retaining its synthetic banner and unchanged fictional scenario data.

The Android catalogue and grading must remain aligned with the shared content module; publication snapshots determine which related articles are available offline. External reference URLs require connectivity. Local quiz answers remain durable without connectivity. No stale bundled headline is labelled a live refresh.

E2E-WEB-170 and E2E-OFFLINE-221 passed with source links, persisted grading, idempotent offline attempts, reload, fictional-lab separation and overview context. WEB182 also passed reader→linked learning→Back. The full existing learning/privacy regression and all10 offline cases passed; the approved public snapshot and APK were regenerated. See [current run IDs and evidence](status.md). Live feed coverage depends on independently accepted and published source adapters; an empty topic does not imply a working unavailable source.
