# SRC-004-DISCOVERY — Official financial filing RSS discovery

- **Status:** Implementation complete; validation pending
- **Scope:** Capture verified official NSE RSS by original upload, bounded fetch or disabled-by-default schedule. Preserve original/revision pointers and literal publication text with unknown timezone, immutable source versions and paginated Operations inbox. Security identity and financial contents remain explicitly unverified.
- **Specification and source research:** [Parent](SRC-004.md); [discovery implementation](../development/filing-discovery.md).
- **Data:** Migration128 adds permission and immutable discovery records. Exact RSS originals remain in MongoDB. No public financial API or offline financial projection is created from discovery metadata.
- **Cases:** API2000–2003, WEB2000 and OFFLINE2000, covering permissions, original grammar, history/replay, scheduled capture, actual inbox controls and offline refusal. Authored, not executed.
- **Remaining:** User-run validation and actual source activation; unattended network access can fail in this environment. Original XML/taxonomy parsing and exact identity/rendered-source mapping remain separate source-parent gaps. The inbox never pretends that a discovered link is a verified financial statement.
- **Manual next action:** Configure PostgreSQL/MongoDB/API/web, apply `pnpm db:migrate`, then `pnpm sdlc "Validate official filing discovery" -- --grep "E2E-(API|WEB|OFFLINE)-200[0-3]"`. Use Operations → Filing discovery and Automatic research. Report ID/project and saved run/error-context.
- **Commit:** Baseline `a2c53a0`; no gates, jobs, migrations, app builds or commit executed. Manual SDLC owns the conditional commit.

## Reusable task prompt

Read AGENTS.md and linked source/specification. Resolve concrete permission, parser, revision/replay, inbox or scheduled-capture defects. Preserve literal source timestamps and unresolved identity; never infer an ISIN from a title or turn RSS metadata into financial facts. Update cases/docs/status without running deterministic validation or committing.

## Current acceptance review — 20 September 2026

Reviewed scope: Official NSE RSS original upload, bounded fetch and disabled-by-default scheduled capture, immutable original and revision pointers, literal publication text with unknown timezone, retained originals, permission re-admission and paginated Operations inbox. Security identity and financial contents remain unverified; offline refuses financial projection and source writes. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926953092-78982.
<!-- sdlc-validation:end -->
