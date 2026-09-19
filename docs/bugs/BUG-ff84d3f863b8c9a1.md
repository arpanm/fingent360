# BUG-ff84d3f863b8c9a1

- Status: Resolved
- Case/project: E2E-API-276 / api
- Stories: EVIDENCE-LINKS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 27
    + Received  +  1

      Array [
    -   Object {
    -     "action": "create",
    -     "consentedAt": "2026-09-18T17:59:16.856Z",
    -     "id": "6262989a-b0ca-4dc9-9e36-426bcaa7f283",
    -     "note": "My research question, not a claim of financial impact.",
    -     "removed": false,
    -     "savedAt": "2026-09-18T17:59:16.856Z",
    -     "source": Object {
    -       "effectiveLabel": "Official press release",
    -       "itemId": "fed-801d63c5c41391b968dca5c5f676d799",
    -       "name": "Federal Reserve Board",
    -       "publishedAt": "2026-09-11T14:00:00.000Z",
    -       "retrievedAt": "2026-09-13T08:18:36.250Z",
    -       "sourceHash": "59a12c7db8159d813da4be05c8be221d723dcff8fab390f1c4b21f91b8dac643",
    -       "url": "https://www.federalreserve.gov/newsevents/pressreleases/bcreg20260911a.htm",
    -       "version": 4,
    -     },
    -     "target": Object {
    -       "binding": Object {
    -         "id": "INE002A01018",
    -         "kind": "holding",
    -         "version": 1,
    -       },
    -       "label": "INE002A01018",
    -     },
    -     "version": 1,
    -   },
    +   null,
      ]

      712 |     expect(
      713 |       revisions.rows.map((row: { payload: unknown }) => row.payload),
    > 714 |     ).toEqual([saved]);
          |       ^
      715 |     expect(
      716 |       (
      717 |         await blocker.query(
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/research-connections.spec.ts:714:7
