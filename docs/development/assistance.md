# Configurable grounded assistance (ASSIST-001)

SmartHelp offers optional field explanations and goal-name suggestions in the authenticated investor workspace. It never changes saved data: Apply name suggestion changes only the visible goal-name draft, and the normal review/consent/save flow still applies. There are no generated amounts, allocations, trades or market forecasts.

## Configuration

Use server-only configuration `AI_PROVIDER=auto|query|openai|gemini|anthropic` and matching key/model pairs:

- `OPENAI_API_KEY` and `OPENAI_MODEL`
- `GEMINI_API_KEY` and `GEMINI_MODEL`
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`

No model names are inferred or supplied as defaults. A provider is available only with both key and explicit model. Auto uses the configured default, or the first available provider in OpenAI/Gemini/Anthropic order. Query makes no remote generation request. Missing configuration, provider errors, malformed output, unknown references or ungrounded text fall back to clearly labeled query matches. Options reveal provider names/model identifiers only to authenticated accounts, never keys.

Keys remain on the server and are never returned, logged, stored in browser state or committed. There are no new dependencies and no schema migration: requests/results are not stored by this feature. Applied names are ordinary user-confirmed goal data. Remote provider retention remains governed by its configured account/service terms; the app does not claim universal zero retention. OpenAI requests specify store:false.

## Grounding and consent

Query mode searches published glossary summaries, product field definitions and optionally owned saved goal names, holding identifiers or saved glossary references. Monetary values, passwords and session data are excluded from remote context. History is off by default and requires the per-request checkbox; when remote assistance is selected its text explicitly permits sharing relevant matches. The user's question itself is sent remotely when that provider is selected, so the UI asks them not to include secrets or private documents.

Provider assistance selects complete supplied reference texts or a supplied editable goal name. Output must reference a supplied source ID and match its text; invented values and unsupported claims are rejected. Source/query text cannot enable tools or change instructions. Fixed HTTPS provider hosts, no redirects, no tools, bounded eight-reference context, 500-character questions, 700 output tokens, 64KiB response limit, 12-second remote timeout and no automatic retries limit requests. Per-account requests are capped at10/minute, remote requests at30/minute per API process and two concurrent calls. These process limits supplement provider-account spending controls; they are not a fleet-wide billing cap.

## Official interfaces checked

- OpenAI Responses: [Text generation](https://developers.openai.com/api/docs/guides/text), using instructions/input and extracting output_text message content.
- Gemini Generate Content: [Google's generate-content guide](https://ai.google.dev/gemini-api/docs/generate-content/text-generation), using x-goog-api-key, contents and bounded generationConfig. This documented interface is marked legacy by Google; operators must choose a compatible model.
- Anthropic Messages: [Create a Message](https://platform.claude.com/docs/en/api/messages/create), using system/messages/max_tokens and text content blocks.

The reference pages were read during implementation. No paid provider request was made by this agent.

## Verification

With app/database migrations ready, manually run `pnpm format` and `pnpm check`, then API/browser `@ASSIST-001` in the existing E2E UI with watch mode off. API150 covers auth, Origin, strict fields, query mode and opt-in ownership; WEB150 proves that a suggestion does not change a field before Apply. Unit fixtures cover each HTTP request/response adapter, missing model configuration, ungrounded output rejection and credential-safe errors without network access. Parent reports executed evidence separately.

For optional live verification, configure one supported key/model pair on the server, restart the app, deliberately select that provider, ask a non-private field question and inspect the returned provider/model attribution. Repeat independently for each configured provider; a fallback is not a live pass. Test history opt-in only with synthetic accounts. On failure, report artifact run details without credentials or private queries.

The same configured adapters can optionally select exact source captions for operator-prepared media. They do not generate fictional image content or cinematic video. Media preparation has independent concurrency/budget limits and durable per-edition attempt reservation; see the media workflow documentation. Reader requests never invoke a provider.

Provider selections must equal a complete supplied reference text. Arbitrary substrings, dropped qualifying sentences and shortened goal names are rejected. Summaries over 700 characters are omitted from assistance rather than cut mid-context. Invalid selections use the deterministic query fallback. Unit regression cases cover removal of negation and surrounding qualifiers.
