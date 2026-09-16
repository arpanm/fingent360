# Bug tracker

User-run SDLC maintains this index and stable per-case/project bug records. Unsuccessful repairs remain Open. Only an exact passing case resolves a test bug; skipped, unselected or unrelated passing tests do not. Command failures have separate workflow bugs. Detailed evidence stays in local artifacts; tracked excerpts are bounded and redact configured secrets.

The current known account registration failure is recorded in [ACCOUNT-001](../tasks/ACCOUNT-001.md#registration503-blocker--2026-09-16): missing first-time encryption configuration; the user confirmed a fresh installation. No successful registration rerun is recorded yet. New SDLC runs automatically create structured bugs from their own reports.

- [BUG-99cc743e4a8bae69](BUG-99cc743e4a8bae69.md): **Open** — account registration returned503; saved failure imported explicitly, not a new test run.
