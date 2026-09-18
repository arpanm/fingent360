# Reading updates — READING-FOLLOW-001

Reading updates lets a signed-in reader explicitly follow reviewed catalogue sources or topics and manually check editions already stored by Fingent360. Enter from Saved reading or More. Source/topic matching is OR and one item produces at most one current notice. These subscriptions are separate from Library ranking preferences, saved articles and financial research connections.

A notice records a reading change, not urgency, portfolio exposure or an investment signal. This feature does not fetch providers, run a worker, monitor continuously, send email/push, use an LLM or modify financial records. Its provider provenance comes from existing reviewed source editions and SOURCE-WITHDRAWAL-001 admission.

## Subscription and notice rules

Choose up to30 unique catalogue sources and30 unique topics, explicitly consent, review, then save a versioned configuration. Existing selected topics remain removable when they disappear from the currently published catalogue. Unknown new topics and source IDs are rejected. Saving identical settings returns409.

- New or re-added follows establish a seen baseline; they do not deliver the earlier backlog.
- Settings edits preserve observations for retained overlapping follows. Removing one of a source/topic pair does not resolve an item while another previously selected matching key remains. These edits do not silently consume a later source edition.
- Removing every matching follow resolves an existing open or acknowledged notice. Its history remains.
- Mute freezes retained observations and disables checks. Explicit unmute establishes fresh baselines and resolves prior notices without delivering the muted-period backlog. Review states this before confirmation.
- A check detects newly matching published items, changed reviewed editions, withdrawal, republication or loss of membership. A draft alone is never a new public observation. Notice heads coalesce by owned item ID; an unchanged check neither duplicates nor reopens an acknowledged notice.
- Acknowledge binds the exact expected notice version and the configuration recorded by that observation. It does not adopt newer settings or source editions. A later change reopens the notice.

Operation request IDs are durable and scoped to the account. Identical retries return the original dated receipt; changing the action or input under that ID returns409. A replay is historical. The UI clears current-context eligibility until an authoritative GET succeeds, including after a committed request whose response was lost.

## Storage, bounds and authorization

Migration032 adds three PostgreSQL tables, all cascading from app_users:

| Table                  | Purpose                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| reading_follow_configs | Current versioned settings                                                                            |
| reading_follow_items   | Minimal baseline or coalesced notice per owned item                                                   |
| reading_follow_events  | Immutable config/item/operation records, ordered by sequence, with unique owned operation request IDs |

The ledger reconstructs heads and preserves receipts until account deletion. Its trigger rejects edits or independent deletion. It stores identifiers, matching keys, publication state, versions, timestamps and explicit choices. It does not store article titles, bodies, summaries or URLs. There is no lifetime notice/operation cutoff and no automatic deletion policy.

Account writes and reads acquire the account lock and reauthorize after it. Checks/settings scan the union of source heads and owned observations in globally sorted batches of at most200 IDs, using an initial upper ID boundary. Source SHARE admission and current-clock reauthorization precede each batch. Writes and the completed receipt commit together. Each statement has a3second timeout; a10second operation deadline is checked between work and before completion. Failure rolls back the operation, leaving its original request retryable.

A scan reports its start and completion times; it is not an instantaneous snapshot of the entire source catalogue. Concurrently inserted heads missed by the traversal are considered by a later check. Large checks that cannot finish within the deadline fail atomically; no resumable background job is introduced.

Current notices and immutable history pages contain at most100 rows. Inbox cursors are validated item IDs; history/export cursors are validated numeric sequences. Every query independently filters the authenticated owner. There is no OFFSET traversal or unbounded server-side application buffer. Financial/account mutation ordering, existing recovery protections and source-withdrawal locks remain in force. Origin checks protect mutations; foreign notices return generic404.

## API and disclosure

| Method/path under /api/v1/account/reading-follow | Behavior                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| GET, optional after                              | Current settings and one dated notice page, with currently admitted available item IDs |
| PUT                                              | Complete settings, requestId, expectedVersion and consent; baseline/settings receipt   |
| POST /check                                      | requestId and expectedVersion; completed manual-check receipt                          |
| POST /notices/:itemId/acknowledge                | requestId and expectedVersion; exact notice acknowledgement                            |
| GET /export, optional after/upper                | One immutable event page with ownerId and frozen upper sequence                        |

Runtime schemas reject unknown fields, duplicate selected keys and malformed identifiers/cursors. Public text is never copied into a notice. Current-reader links are offered only for currently admitted published items. Withdrawal or an unavailable source removes those links while owned acknowledgement and history remain available.

Privacy export includes the first reading-history page. The download collector consumes every continuation through the same upper sequence, verifies the owner and current account, and creates a complete artifact only after all reading and report-schedule pages succeed. A later-page401 clears private UI and prevents a partial download. Other page failures retain an explicit retry. Account deletion removes only that owner's settings, observations and event history; other accounts and public sources remain.

## UI, accessibility and local mode

The shared screen has loading, no-follow, no-notice, filtered-empty, muted, error, draft, review, saved receipt and uncertain-retry states. Explicit Reload returns to the first notice page; status filtering applies to that page. More opens the next bounded notice/history page. Current GET observation time is not presented as a new check. Saved action receipts and history identify completed action times.

Sources/topics use labelled checkboxes, review uses the existing keyboard dialog, and unsaved edits use the existing discard guard. Pending settings requests disable every draft control. Selected vanished topics remain visible for removal. Closing an in-flight history page invalidates its response and restores controls; a late successful read cannot restore private data after an actual401. The reader route has existing Back/dialog behavior. Identifiers wrap on mobile, and private content is marked for feedback masking.

On-device mode uses the same reducer and highest non-draft bundle resolver in the existing serialized local transport. One complete local update commits atomically; the10second deadline also applies. Local state stores the owner's configuration, heads and event ledger. The actual bundle is already resident in memory; local history is bounded per response, while browser download collection materializes the complete user's export. Device mode makes no API/provider request and does not synchronize with a server. It cannot detect publications or withdrawals absent from its dated bundle; install an updated bundle to see them. Account deletion removes only the local owner's map.

## Acceptance and verification boundary

Authored coverage consists of API440–445, WEB440–445, OFFLINE450–451 and5 shared-domain unit cases. It covers baseline/change/ack/reopen, overlap and mute rules, request replay and conflicts, owner isolation/deletion, actual lock-wait expiry rollback, more than200 source heads, bounded notice/history pagination, frozen export cutoffs, later-page401, lost committed responses, first-load recovery, pending draft controls, exact selection and reload persistence across similarly named legitimate sources, closing pending history, keyboard/mobile navigation and zero-network local persistence.

Provider/source fixtures use retained public bundle data. Synthetic later editions, pagination records and transport interruptions are explicitly labelled test simulations and confined to owned schemas/state. They establish no live source or provider claim. No test/build/format/migration/service/provider command was run by the authors. Parent integration and authorized gates, followed by separate physical-device/visual acceptance, determine verification. See the development handoff for commands, exact files and limits.

## Parent integration refinements

Current notice responses project a readable title/source name/current edition only from admitted published reading, without storing it in notice history or exports. The UI labels current metadata separately from the observed edition and hides it until an authoritative load; withdrawn items show an unavailable label with the opaque receipt ID under Notice reference. API440/WEB440/OFFLINE451 verify titles disappear after withdrawal and do not enter history. Previously selected vanished topics remain available throughout editing so removal can be undone before saving. Numeric event pagination explicitly orders the underlying bigint sequence, avoiding lexical ordering of the JSON string representation; API441/445 retain uniqueness/completeness/frozen-boundary assertions. These corrections require parent rerun; they are not claimed verified here.
