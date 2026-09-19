# BUG-e688adc1d1972b8e

- Status: Open
- Case/project: E2E-WEB-1881 / mobile
- Stories: DEV-018
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    error: invalid input syntax for type json

       at ../helpers/reading-calendar.ts:44

      42 |     db = await connectionDatabase(sandbox);
      43 |   try {
    > 44 |     await db.query(
         |     ^
      45 |       'INSERT INTO research_calendar_editions(hash,source_id,retrieved_at,data) VALUES($1,$2,$3,$4)',
      46 |       [value.edition, value.sourceId, value.retrievedAt, value.events],
      47 |     );
        at /Users/arpanmacmini/code/fingent360/node_modules/.pnpm/pg-pool@3.14.0_pg@8.23.0/node_modules/pg-pool/index.js:45:11
        at seedReadingCalendar (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/reading-calendar.ts:44:5)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/reading-calendar.spec.ts:8:3
