# Task records and maintenance

[TODO.md](../../TODO.md) is only the task index: one row per stable task ID, a clear title linked to its detail file, current status, pickup readiness, and a plain-English blocker or next action. Do not put prompts, summaries, implementation logs or long acceptance criteria back into the index.

Read [current delivery](current-delivery.md) for the latest nine-workstream breakdown. Each `ID.md` file is the task’s detailed record. Historical coordination batches point to their children; finishing a child does not automatically finish its broader parent.

## Status meanings

Use **Done (recorded scope)** for bounded deliveries with recorded acceptance, and **Done (documentation)** after the documentation acceptance review. Neither certifies later code changes. Do not hold documentation-only work open waiting for application E2E. Implementation-complete tasks awaiting runtime checks must retain that explicit qualifier; do not relabel them Done solely to clear the list.

- **Planned:** implementation has not started for the stated scope.
- **In progress:** implementation is actively underway; list exactly what is unfinished.
- **Partial:** some functionality exists but named functional or acceptance requirements remain missing.
- **Blocked:** give the specific missing input/dependency, the responsible person and the next step. Do not use this for ordinary developer research or an unrun test.
- **Completed implementation; validation pending** (previously “Implemented; validation pending”): the stated implementation is authored; it is not a pass, production activation or device acceptance claim.
- **Completed implementation; manual validation pending:** all stated code/workflow/spec/test-authoring requirements are complete; this explicitly does not claim checks, live activation or device acceptance passed. Use only after inspecting remaining scope.
- **Completed (recorded scope):** recorded validation supports that bounded task/revision. Later edits need fresh validation.
- **Deferred:** deliberately outside the current delivery stage; state the prerequisite for picking it up.
- **Archived coordination:** historical team/batch tracking, not a separate feature to restart; child tasks own outstanding work.
- **Needs review:** evidence is insufficient to claim a more specific state; identify what the developer must inspect.

## Required update after every implementation

1. Find the existing task ID before creating another one. Read its detail file and current user instructions.
2. Update its specification and reusable prompt if the scope changes. Record spec, web/Android UX, API/contracts, database, real-source ingestion, tests and documentation, or a concrete reason a layer is not applicable.
3. Update **Implemented**, **Pending**, **Next action / inputs** and **Verification** in the task file. Separate missing code, unavailable source inputs, disabled configuration and unrun acceptance.
4. Update the matching TODO row in the same change. Name who acts next: developer research/implementation, operator configuration or user validation. Avoid “blocked” without a specific blocker.
5. Reconcile affected parent DEV/SRC tasks and README/current-delivery summary. A generic importer is not a completed named parser; a source registry is not ingestion; authored tests are not test passes.
6. Preserve dated run IDs/commit evidence in the detailed task. Supersede stale statements in the current summary instead of erasing history. Keep working-tree status separate from commit and runtime activation.
7. Leave deterministic commands to the user-operated SDLC gates. Do not infer execution permission from archived prompts. Never push automatically.

## New task template

Use a stable ID and `docs/tasks/ID.md`:

```markdown
# ID — Clear task title

- **Status:** Planned
- **Implemented:** None yet.
- **Pending:** Specific missing behavior.
- **Next action / inputs:** Who acts and what they need to do.
- **Verification:** Not run.

## Specification and acceptance

User request, dependencies, affected layers, positive/error/offline flows and acceptance criteria.

## Implementation and remaining gaps

Code/data/source evidence, explicit missing pieces and activation requirements.

## Tests and handoff

Authored cases, exact user-run command, prerequisites, recorded results and commit state.

## Reusable task prompt

Task-specific instructions with enough context to implement the remaining scope.

## History

Dated previous scope, implementation and verification records.
```

## Migration and historical evidence

The [migration inventory](migration-inventory.md) lists all 178 migrated/current task records. The [unaltered former TODO](../archive/TODO-before-task-index-2026-09-15.md) retains the original narrative and prompts. Its relative links reflect its former repository-root location; use the migrated task files for navigation. Entries inside “Preserved specification, prompts and history” are historical context, not instructions to run commands or proof that current changes passed tests.

Manual documentation acceptance: every index row opens a task file; each original ID has a record; old status claims remain recoverable; the current nine workstreams distinguish implemented and missing functionality; TODO contains only the list. No application test or database migration is required by this documentation-only restructuring. Formatting/checks and the local commit still use user-run gates.

## Input triage and automatic pickup

Use [pickup queue](pickup-queue.md) to choose the next task. Each reviewed task has a dated input record containing readiness, existing answers, whether a fresh question is needed, later input triggers and the next action. Research-ready means the agent can start researching now, not that rights or formats are already verified. Agent-ready permits authoring, not deterministic validation. Validation-only tasks should consume completed saved evidence rather than be reimplemented. Parent rows follow children; planned/deferred rows outside this pass must be triaged before claiming readiness.

Do not ask the user to discover source formats or interpret regulations. Exhaust relevant primary evidence first. Reuse recorded user answers. Ask only for a specific unavailable private input or decision, record the exact answer and its date, and update all affected task rows. Never treat absence of an answer as approval. Keep regulatory/provider activation gates distinct from independent development.
