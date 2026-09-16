# SRC-004-DISCOVERY — Official financial filing RSS discovery

- **Status:** Completed discovery implementation; validation pending.
- **Scope:** Capture verified official NSE RSS by original upload, bounded fetch or disabled-by-default schedule. Preserve original/revision pointers and literal publication text with unknown timezone, immutable source versions and paginated Operations inbox. Security identity and financial contents remain explicitly unverified.
- **Specification and source research:** [Parent](SRC-004.md); [discovery implementation](../development/filing-discovery.md).
- **Data:** Migration128 adds permission and immutable discovery records. Exact RSS originals remain in MongoDB. No public financial API or offline financial projection is created from discovery metadata.
- **Cases:** API2000–2003, WEB2000 and OFFLINE2000, covering permissions, original grammar, history/replay, scheduled capture, actual inbox controls and offline refusal. Authored, not executed.
- **Remaining:** User-run validation and actual source activation; unattended network access can fail in this environment. Original XML/taxonomy parsing and exact identity/rendered-source mapping remain separate source-parent gaps. The inbox never pretends that a discovered link is a verified financial statement.
- **Manual next action:** Configure PostgreSQL/MongoDB/API/web, apply `pnpm db:migrate`, then `pnpm sdlc "Validate official filing discovery" -- --grep "E2E-(API|WEB|OFFLINE)-200[0-3]"`. Use Operations → Filing discovery and Automatic research. Report ID/project and saved run/error-context.
- **Commit:** Baseline `a2c53a0`; no gates, jobs, migrations, app builds or commit executed. Manual SDLC owns the conditional commit.

## Reusable task prompt

Read AGENTS.md and linked source/specification. Resolve concrete permission, parser, revision/replay, inbox or scheduled-capture defects. Preserve literal source timestamps and unresolved identity; never infer an ISIN from a title or turn RSS metadata into financial facts. Update cases/docs/status without running deterministic validation or committing.
