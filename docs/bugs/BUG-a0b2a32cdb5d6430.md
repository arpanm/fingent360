# BUG-a0b2a32cdb5d6430

- Status: Open
- Case/project: E2E-API-1690 / api
- Stories: DEV-029
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    error: Discovery revisions are append only

      42 |   try {
      43 |     // Explicit synthetic publication timing and due clock, actual scheduling/DB/admission/outbox.
    > 44 |     await pool.query(
         |     ^
      45 |       "UPDATE discovery_versions SET data=jsonb_set(data,'{publishedAt}',to_jsonb($2::text)) WHERE item_id=$1",
      46 |       [source.id, new Date().toISOString()],
      47 |     );
        at /Users/arpanmacmini/code/fingent360/node_modules/.pnpm/pg-pool@3.14.0_pg@8.23.0/node_modules/pg-pool/index.js:45:11
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/whatsapp-schedule.spec.ts:44:5
