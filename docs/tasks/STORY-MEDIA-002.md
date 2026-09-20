# STORY-MEDIA-002 — One-time animated gesture help and generated story media

- **Status:** Image preparation acceptance and replay repair authored; user validation and external gates pending
- **Implemented / recorded:** Image generation/retention/review, shared/offline images and one-time animated gesture help are authored.
- **Pending:** Live image-provider and physical-device acceptance remain pending. Generated video is not implemented.
- **Next action / inputs:** User-run scoped validation of new real preparation cases below; collect live provider and physical-device evidence separately.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### STORY-MEDIA-002 — One-time animated gesture help and generated story media

- **Status:** Authored: source-bound image generation/retention/review, shared story rendering and one-time gesture onboarding; tests not run. Migration057 authored. Generated video not implemented.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver one-time animated gesture help and generated story media with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on STORY-MEDIA-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation + activation
- **User input needed now:** No for the independent next step.
- **Decision:** Do not reimplement authored functionality or assume keys are absent. Existing provider choice is settled; actual configuration and device/live acceptance must be evidenced.
- **Recorded answer / authority:** User requested configurable OpenAI/Gemini/Anthropic and query fallback, with offline Android testing before later server/CDN deployment.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Only ask for the exact missing environment/account or device observation after the task’s documented validation identifies it. Never request secrets in chat.
- **Next action:** No new code decision. Use existing provider/offline choices; collect actual validation and activation evidence.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Current acceptance review — 20 September 2026

Reviewed scope: Source-bound reviewed conceptual images and once-per-document gesture help with reduced-motion fallback. This is generated-image scope; provider-generated video remains unimplemented and excluded. Wider parents, actual source permissions, operational provider activation and native release certification remain separate; gaps listed in externalGates prevent automatic Done.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

Remaining gates:

- Save actual image preparation request/replay/concurrency/source-change/named-approval and Operations error/retry acceptance; API1140 seeds a synthetic retained image attempt and tests review/public bytes, not the full generation workflow.
- Record required live provider/model/attempt review and physical-device visual/touch acceptance separately; current synthetic image fixtures establish neither.

## Remaining completion gates — 20 September 2026

The complete current automated matrix passed. The reviewed manifest retains these separate requirements; rerunning passing cases does not satisfy them:

- Save actual image preparation request/replay/concurrency/source-change/named-approval and Operations error/retry acceptance; API1140 seeds a synthetic retained image attempt and tests review/public bytes, not the full generation workflow.
- Record required live provider/model/attempt review and physical-device visual/touch acceptance separately; current synthetic image fixtures establish neither.

## 2026-09-20 preparation acceptance specification (before code)

Latest instruction authorizes closing the independently actionable generation acceptance gap by authoring only in the isolated worktree. Existing live provider/model activation and physical-device visual/touch gates remain; generated video remains excluded. Existing seeded-attempt API1140 is review evidence, not generation evidence. Do not claim a synthetic provider pass as live-model validation.

Acceptance scope: actual named-operator HTTP image preparation must create immutable attempt/output rows from a synthetic provider response, preserve provider/model/request identity and private-until-approved status; exact same request replays without another provider call. A held provider response must make concurrent same/new requests fail without duplicate output. Changed/withdrawn source during generation must prevent current attachment/publication while retaining audit bytes. Failed provider attempts must remain failed, same-ID recovery must not regenerate, and explicit new-ID retry must create actual successful storage. Named self-review is denied; independent approval includes exact imageAttemptId and published bytes, then withdrawal removes public media. Replaying an older succeeded request after a newer generation must not silently return a different attempt's bytes.

Operations browser acceptance exercises real preparation, in-flight disabled state, actual provider failure, same-ID recovery and explicit new attempt through keyboard activation, source-bound displayed model/attempt and no horizontal overflow on mobile, with synthetic-only screenshot evidence. Where transport loss is simulated, retain the real committed response and recover the same request; do not fulfill an invented success body. Production defects require coordinated minimal changes with parent before edits.

Test-only fixture option defaults off, uses no live key or provider network and installs only inside the spawned isolated API test process. A separate owned-schema control table controls synthetic upstream hold/failure and counts calls; no attempt/output/review rows may be seeded. API/controller/auth/provider parser/store/review remain actual. No dependencies, production migrations, source approval or external activation changes. Shared tracker/catalogue/manifest edits belong to root. All validation remains user-operated.

## Authored preparation coverage and replay correction — 2026-09-20

The actual image POST route now has opt-in synthetic upstream acceptance through the existing isolated API fixture. `storyImageSimulation` defaults false; only the spawned test process configures the synthetic model/key and a provider transport with bounded hold/fail controls. It accepts only the expected provider URL/method/synthetic credential and blocks other outbound fetches. Its control table contains test transport state, not application attempts. The actual controller, named authorization, parser, image store, immutable records, review proposals and public reader serve every acceptance response. No paid provider is contacted by these cases.

A confirmed replay defect was corrected in `apps/api/src/media.ts`: a successful older request previously returned the newest image from `read`. It now returns409 if the latest image attempt differs, requiring reopening the current visual instead of silently substituting bytes. Replay of the current succeeded attempt remains idempotent. Error response contains no provider key/output. Existing source checks, publication locks, provider failure retention and private reading remain unchanged.

Authored cases (not executed):

- API1146: actual held generation request; concurrent same/new IDs rejected; one retained provider output; exact replay without extra provider call; private until independent named review; self/direct review denied; published bytes exact; immutable receipt; independently reviewed withdrawal.
- API1147/API1149: source revision/withdrawal while provider response is held; actual successful bytes retained under original asset, no current/public attachment or review.
- API1148: actual provider failure retained; same failed ID cannot regenerate; explicit new requests succeed; stale exact-image approval conflicts; older successful request replay conflicts instead of returning latest image; provider call counts remain exact.
- WEB1146, desktop and mobile: keyboard prepare/recover/new-attempt controls; actual provider error and explicit recovery error; held request disables preparation; successful committed response lost in transport, then same-ID replay without another provider call; returned model/attempt/PNG labels, unpublished status, focus return,360px containment and synthetic-only screenshot.

These cases add to existing API1140/API1141, WEB1142/WEB1143/WEB1145 and OFFLINE1144; they do not replace retained-image/offline acceptance. API generation logic has no new offline execution path. Root owns catalogue, coverage, acceptance matrix and shared tracker reconciliation. Remove only the agent-actionable preparation-coverage gate after integration and actual selected receipts; keep live-provider/model review and physical-device gates. Video remains excluded. Historical generated validation blocks above do not certify these new edits.

Manual handoff after parent integrates all authoring:

```sh
pnpm sdlc "Complete story image preparation acceptance" -- --grep 'E2E-(API|WEB|OFFLINE)-114[0-9]'
```

No dependency or production migration added. Existing owned PostgreSQL/Mongo and the user-started API/web are required; use launcher URLs (latest saved targets API http://127.0.0.1:4104 and web http://127.0.0.1:5176). In Operations → Publishing → Prepare visual summary, expect actual failure/recovery/new-attempt behavior with the fixture, independent review, exact image identity and no public bytes before approval. Inspect WEB1146 synthetic screenshot for focus/narrow layout; a desktop screenshot is not physical-device certification. On failure report run ID, case/project, assertion and saved trace/error context, without credentials/provider secrets.

Nothing deterministic was run: no tests, browser automation, builds, formatting, checks, migrations, service changes or commit. Authoring base c7874a5, isolated worktree `/Users/arpanmacmini/code/fingent360-authoring-20260920`; commit awaits user-run format/check gates. Other collaborators' changes are preserved. Superseded replay repair and authored cases still need validation; no pass claimed.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
