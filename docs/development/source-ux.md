# Source research journeys — SOURCES-002

Today requests the bounded diversified research selection; Explore requests the complete searchable collection. Both expose source, exact topic and India/global focus using the same server filters for guests and authenticated readers. Source selectors contain actual published counts. Coverage failures have an independent retry and do not pretend the current article collection is empty.

The URL preserves query, content kind, source, topic, region and Scan/Stories mode. Changing controls replaces the current selection; opening a reader creates a real Back transition. Returning restores the chosen view and existing navigation scroll/focus. Stories supports previous/next buttons, focusable arrow-key navigation and the existing dedicated swipe area. Today ends with Explore all reading; Explore paginates until its real cursor is exhausted. Empty results offer reset, and loading/error/retry states remain visible.

Readers link to their exact publisher, source-filtered Explore, immutable history and available evidence. A separately loaded, version-checked context section displays human-authored explanations, published related reading, sourced terms and actual learning question links. It carries the backend caveat and never infers a portfolio impact or recommendation. Context errors are retryable without hiding the article.

Sources separates actual published research coverage from the existing approved rights registry. Coverage records disclose access status, count, latest publication, successful check, rights and failed checks. Blocked and review-required sources are not presented as working adapters. Offline coverage remains explicitly dated; publisher websites need a connection.

E2E-WEB-180 covers global filtering, Scan/Stories, keyboard transitions, Reader/Back, empty/reset and source-directory links. E2E-OFFLINE-220 covers source→Stories→Reader→Back/reload with zero API network requests. Both cases passed, along with WEB181/182 and the full web/API and offline suites. Exact run IDs and APK evidence are in [status](status.md). The virtual Learning lab remains a separately labelled synthetic exercise.

## Manual operations and refresh helper

Operations → Publishing lists fixed source adapters with eligibility, published counts and independent latest-run status, checked/new-draft counts and messages. Select enabled sources explicitly, then Refresh discovery sources. The UI allows up to five minutes for the bounded multi-source operation. On a timeout, reload source status before submitting again. Existing per-item preview/review/publication controls remain the publication gate; source refresh never silently publishes drafts.

Optional user-invoked helper (API running and current contracts built):

```bash
node scripts/research-refresh.mjs --sources=fed,ecb-press,pib
# Only after deciding these newly fetched editions are eligible for your explicit review policy:
node scripts/research-refresh.mjs --sources=glossary --publish --note="Reviewed source attribution and educational explanations against the cited references."
```

The helper reads the local environment without printing credentials, targets the configured loopback API port, validates every source against the enabled catalogue, and uses the normal short-lived operator session. Default behavior leaves drafts unpublished. Explicit `--publish` requires a review note and only publishes new/changed drafts produced in the selected sources, using optimistic edition checks and reporting individual failures. It never retries an uncertain refresh or runs on a timer. E2E-WEB-182 covers current PIB evidence/history/learning and return to the filtered story, including removal of duplicated source excerpts. Today filters are collapsed initially; Explore exposes them, and mobile groups topic/focus side by side. Reader edition notes remain available under an explicit disclosure. E2E-WEB-181 covers source selection and a real glossary refresh outcome in Operations.
