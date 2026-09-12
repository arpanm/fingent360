# End-to-end fixtures

Only synthetic, non-personal data belongs here. No holdings exports, broker tokens or production documents. Current browser fault tests explicitly simulate responses with Playwright routing; current API smoke tests use real local services and need no seed data.

For each future fixture record its ID, linked TODO task, scenario, expected accounting totals, timestamps/units, provenance, owner and cleanup. Never turn historical chat market claims into verified fixtures. Tests must isolate their own records and never truncate a shared database.
