# SRC-004-ORIGINAL-XBRL — Original NSE XBRL instance adapter

- **Next action / inputs:** Obtain the verified original XBRL instance and taxonomy bytes; then implement and validate the original-source adapter.
  <a id="src-004--original-nse-xbrl-instance-adapter"></a>

Status: researched; implementation pending original instance and taxonomy bytes. This is a child of [SRC-004](SRC-004.md) and [SRC-005](SRC-005.md), not a completed source integration. Research dates: 15 and20September2026. Public research found the exact originals, but their bytes remain unavailable in this session. A normal-browser download availability question is pending; no answer is assumed.

## Verified acquisition discovery

The official [Integrated Filing – Financials table](https://www.nseindia.com/companies-listing/corporate-integrated-filing?integratedType=integratedfilingfinancials) exposes separate rendered Details and original XBRL links. Browser inspection of actual table anchors established these originals:

- [Tiger Logistics original XML](https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1724230_15092026040337_WEB.xml): table identifies quarter ended30June2026, standalone, unaudited, revision. Displayed revision received15September2026 16:03:09 and dissemination16:03:38. The filename time is different and must never substitute for the exchange timestamp. Its separate rendered report is `INTEGRATED_FILING_INDAS_194116_15092026160337_iXBRL_WEB.html`.
- [BLS E-Services original XML](https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1724164_15092026012013_WEB.xml): table identifies quarter ended30June2025, consolidated, unaudited, revision; displayed receipt15September2026 13:20:11 and dissemination13:20:13. Its separate rendered report is `INTEGRATED_FILING_INDAS_194087_15092026132013_iXBRL_WEB.html`.

These are observed official links, not filename transformations. A revision discovered in2026 cannot be assigned knowledge time in2025 merely because its quarter ended in2025.

The official [NSE XBRL information page](https://www.nseindia.com/static/companies-listing/xbrl-information) separately links the [Integrated IndAS taxonomy ZIP](https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Taxonomy%20Integrated%20filing%20finance%20%28IndAS%29.zip) and the [July2026 filing utility](https://nsearchives.nseindia.com//web/mediaattachment/2026-07/Integrated_Filing_Finance_Ind_AS_20260706165729.zip). Public access to a utility or filing does not establish redistribution rights.

## Actual research limitation

The original Tiger XML did not yield source bytes: ordinary curl HTTP/2 returned stream INTERNAL_ERROR; a bounded HTTP/1.1 request timed out after20seconds with zero bytes. Browser navigation reported `ERR_BLOCKED_BY_CLIENT`; clicking its actual table attachment did not produce a file in the local Downloads folder. The web reader could not open the XML. A separate ordinary urllib request for the BLS original and another for the official taxonomy ZIP each timed out after12seconds. No authentication, cookies, session bypass or provider-ingestion job was used. These outcomes establish this session's retrieval limitation, not a claim that the exchange permanently prohibits downloads.

Consequently no instance namespace, taxonomy version, entity-identifier scheme, unit, dimension QName, decimal precision, or numeric fact mapping has been verified. No parser or synthetic taxonomy has been fabricated. Existing rendered adapters remain available. The1870–1879 case range and117migration reservation have not been used.

## Implementation specification and reusable prompt

Obtain an original through its observed official table download and the matching official taxonomy. Inspect unmodified bytes and record SHA256 and the exact source URL before authoring. Confirm context entity identifiers; duration versus instant; quarter versus YTD; standalone/consolidated dimensions; namespace URIs; unit measures; decimals/precision; nil semantics; and all selected concept QNames. Preserve the original source and revision/dissemination metadata separately from period end, board approval and retrieval time.

Implement a bounded versioned parser in contracts only after those semantics are verified. Reject DTD/entity declarations and external resolution; never fetch schemas during parsing. Reject unknown relevant dimensions, dangling context/unit references, conflicting duplicate facts, ambiguous entity or period admission, unsupported precision and invented scaling. Retain unsupported original fields without projecting them as supported facts. Reconcile exact decimal aggregates with source precision, never binary monetary arithmetic. Reuse immutable equity editions, Mongo original retention, strict current identity admission, independent named review and retained-source reparse at publication. Add actual Operations upload and independently reviewed company reader, source/version details, withdrawal, and offline proof admission. Preserve older rendered receipts.

Author API, actual Operations browser, reader and offline cases1870–1879: valid original grammar with disclosed fixture basis; unit/context/dimension ambiguity; duplicate conflicting facts; DTD rejection; revision known-at separation; independent publication; receipt reconstruction; withdrawal; and offline tamper denial. Do not claim a25-company validation set from one issuer. Update current parent summaries and root trackers through the coordinating agent. Do not run tests, services, builds, migrations, ingestion or commits.

## Manual acceptance and handoff

Documentation-only acceptance: confirm both original links correspond to the named issuer/period in the official table; confirm rendered and XML identifiers are distinct; confirm no case, parser or source-validation pass is claimed before original bytes are inspected. No runtime behavior changed in this research step, so no E2E run is requested. User may run `pnpm sdlc "Record original NSE XBRL source research" --checks-only` for documentation checks and gated commit. No dependencies, database migration or service changes. The existing local commit is `a2c53a0`; substantial earlier team changes remain uncommitted pending user-run gates. No format/check/test/build/commit was executed.

## Input question — 2026-09-15

Asked whether the original XML can be downloaded from the official Integrated Financials table in the user’s normal browser. Options: can download / also fails / not tried. No answer received. This asks about concrete access after researched retrieval failures; it does not ask the user to discover formats, provide credentials or grant redistribution rights.

## Original-source recheck — 20 September 2026

The official financials table again populated through its ordinary1W control. It
shows exact symbol, company, quarter, submission/audit/consolidation, rendered
Details and original XML links, with separate literal receipt/dissemination times.
For example the visible INTERARCH revision for31March2025 linked original
`https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1725680_19092026031904_WEB.xml`
and distinct rendered
`https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194882_19092026151904_iXBRL_WEB.html`.
The displayed received time was19September2026 15:17:04 and dissemination15:19:05;
no timezone was inferred. These identifiers must not be transformed into each other.

An ordinary bounded request to this newer original also timed out without XML
bytes. The linked taxonomy ZIP request timed out; browser download actions did
not yield an inspectable local taxonomy/CSV. The rendered listing proves a
source-published pairing exists, but not a downloaded table contract, original
namespace/context/unit grammar or the contents of an unacquired filing. No
original-XBRL parser, live capture or source pass is claimed. Existing rendered
adapters and RSS discovery remain implemented. A supplied normally downloaded
original and matching taxonomy can resolve this concrete access limitation;
the previous availability question remains pending, and was not repeated.

This was read-only research; no product tests, builds, migrations, services or
commits were run. The historical baseline remains separate from new authoring.
