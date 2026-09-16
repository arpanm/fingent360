# Historical Federal Reserve policy pack

EVENT-SCENARIOS-001 now includes authored ingestion and extraction for two actual historical FOMC statements. It remains partial overall: other real event packs, live activation and validation are not complete.

## Evidence and intended result

The [July31,2024 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240731a.htm) retained a5.25–5.5 percent target range. The [September18,2024 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm) set4.75–5 percent. The raw statements use mixed fractions. Corresponding lower/upper changes are both-0.5 percentage point. This is a prior-decision comparison, not a surprise-versus-consensus or estimated market/portfolio effect.

Official text, raw-document hashes and read-only research retrieval metadata are retained in `packages/contracts/test/fixtures/fomc-*`. The [Board copyright policy](https://www.federalreserve.gov/disclaimer.htm) allows attributed Board text reuse unless otherwise indicated; logos/third-party imagery are excluded. No user input is needed for the public historical statements. These fixtures do not seed the application or establish current interest rates.

## Connected end-to-end workflow

1. Operations source catalogue includes **Federal Reserve historical policy decisions** (`fed-policy-history`), restricted to the two researched2024 statement URLs. The existing automatic capture workflow or source refresh retains raw documents in MongoDB and validated historical drafts in PostgreSQL. Capture is idempotent through existing document/version handling; revisions require normal publication review. No provider URL comes from imported text or the client.
2. Inspect and publish the retained source drafts using existing source review. Their titles/effective labels explicitly say historical, not current rates. Create/review an event citing the exact target-range sentence from each statement. No causal sector/company link is invented.
3. Operations → Event scenarios → choose that reviewed event → **Extract FOMC lower bound** or **Extract FOMC upper bound**. The server re-admits current source/event state and operator permissions, validates the official URL/publication-date relationship and extracts only the stated target-range phrase. Latest cited statement supplies the observation; the earlier cited statement supplies an optional prior comparison. Conflicting same-date statements, unsupported fraction syntax or absent exact excerpts produce an actionable error.
4. Review filled measure, dates, citations and values, save the scenario, and obtain the existing independent publication review. The immutable scenario receipt stores the original citations/source hashes and explicit quarter-fraction conversion warning along with the calculated final result. Entering a mismatched decimal bound is rejected.
5. Open the public scenario, its history and underlying reviewed event. Source/event change or withdrawal removes admission through existing policies. Shared React renders connected Android identically. Offline snapshots reuse the receipt and local evidence admission; preparing/publishing remains connected-only. Existing manual APK build/reinstallation is required for installed-app updates.

The provider validates fixed URL/hash, release title/date/time and exactly one target-range sentence before creating a draft. The narrowly supported normalization accepts whole numbers and proper half/quarter mixed fractions using integer arithmetic, preserves the raw tokens, and excludes other numbers such as the inflation target, announced change amount or dissent preference. Generic existing manually entered decimal scenarios remain supported; this adapter does not certify arbitrary editorial claims.

No new migration or dependencies are needed: existing discovery evidence, reviewed event and immutable scenario version tables already store the required data/provenance. No automatic publication, recommendations or portfolio/goal modifications are added.

## User-run acceptance

Run `pnpm sdlc "Add historical Fed policy evidence workflow" --checks-only`, then `pnpm e2e:run --grep @FED-POLICY-PACK-001`. API1260 covers actual owned-database event extraction→draft→review→public receipt and mismatched bound rejection; WEB1260 covers desktop/mobile preparation/public explanation; OFFLINE1260 covers identical retained-evidence exact arithmetic without a network dependency. Provider/parser unit cases verify actual historical document hashes and exact mixed-fraction outcomes. Test review activity is isolated test orchestration, not evidence of a production reviewer sign-off.

For manual live acceptance use configured PostgreSQL/MongoDB and `pnpm dev`, visit the printed URL and Operations. Existing source/event/scenario migrations must already be applied. Refresh/capture the new historical source, review both documents, cite their target-range sentences in an event, then follow the steps above. Leave watch/eye modes off. Report any failure with saved run directory, test/project, error context and the source-capture receipt. No tests, build, format, check, source jobs, service actions, commit or push ran as part of agent authoring.
