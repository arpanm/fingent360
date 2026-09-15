# STORY-MEDIA-002 handoff

Authored implementation; no deterministic commands, provider calls, test runs, migration or commit were executed. Existing HEAD observed earlier efd28d3 is not verification of this change. User invokes validation/gated commit.

## Root integration

- Config optional `STORY_IMAGE_PROVIDER: off|openai|gemini` (default off) and `STORY_IMAGE_MODEL`. Existing corresponding server API key required. This does not use Anthropic as an image provider. Isolated fixtures must keep provider off.
- Register migration057; runtime grants for story_image_attempts/reviews. Existing MediaStore/controllers own the added image POST; no new DI provider required.
- Operations visual dialog renders image.base64 when present and `StoryImageOperations({asset:media,request,onUpdated:setMedia})`. Publish/withdraw bodies must bind imageAttemptId. Media publication proposal contract must allow optional imageAttemptId; Store.review checks it exactly, including when named approval runs later.
- Existing MediaAssetSchema and offline snapshot carry optional PNG image bytes. Max base64 5.4MB fits existing 8MB snapshot response bound. Successful provider output is retained server-side only, never exposed via public asset.

## Data and workflow

`POST /ops/media/:id/image` accepts only requestId UUID. Existing published source and prepared caption asset required. A DB-wide session advisory lock serializes image generation; ten attempts/hour is durable. A repeated successful ID retrieves stored asset, while interrupted/failed IDs cannot cause another paid call without explicit new ID. Source/model/prompt/start/end/output/bytes/failure response are retained in story_image_attempts. Completed attempts and image reviews are immutable. Uncertain network replies are recovered with the same ID. Full provider response payload is stored for later eval linkage; no key/header is retained. Output bytes are bounded canonical PNG with header, dimensions and end marker; unsupported/malformed output fails with a generic public error. Provider HTTP failures retain bounded response body server-side. Timeouts have no response body to preserve.

Public reads add only reviewed images tied to the current admitted source version. Existing caption review policy remains; preparing an image produces a draft visual and requires explicit image-bound approval. Changed image attempts invalidate earlier proposed approvals. Changing/withdrawing a source suppresses the image via existing source admission. Snapshots use exactly the admitted public image bytes; Android remains offline-capable after rebuild/reinstall. A newer pending image does not leak into public assets.

Stories now show a generated illustration if a reviewed one exists; otherwise source text is shown without the arrow/glyph masquerading as imagery. Source-based caption illustration and caption-video export remain in details. Generated video is not implemented or claimed. Gesture instruction uses a dismissible animated overlay once per stories/reader context per page load, with reduced motion and Escape. Swipe surface covers actual story content, so no repeated tall empty teaching panel is needed. Previous/Next and reader preference controls remain.

## Authored tests

- E2E-API-1140: actual owned DB/media workflow with clearly synthetic PNG receipt; exact-image approval, public bytes, durable immutability, withdrawal.
- E2E-API-1141: PNG validator accepts fixture/rejects SVG, invalid dimensions.
- E2E-WEB-1142: desktop/mobile actual API reviewed PNG and conceptual label.
- E2E-WEB-1143: reduced-motion gesture overlay, dismiss-once, keyboard navigation, removed glyph.
- E2E-OFFLINE-1144: shared stories work without direct provider network or arrow placeholders.
- Existing discovery gesture and media review cases remain relevant. No provider pass is inferred from fixtures.

## User next actions

Run `pnpm db:up`, `pnpm db:migrate`, restart `pnpm dev`, then `pnpm sdlc "Add reviewed story illustrations and gesture onboarding" -- --grep 'STORY-MEDIA-002|UX-002'`. Use printed web URL `/#today` → Stories and `/#ops` → existing news item visual review. Configure a server image provider/key only for deliberate paid generation; prepare, inspect, publish, reopen matching story, then generate/rebuild the existing offline Android snapshot/package. Test desktop/mobile/offline projects. Keep watch/eye toggles off. Send exact failed case/project/error plus artifacts/e2e/latest.md run reference on failure. No installation dependency changed.

Manual visual acceptance includes 360px width, large font, reduced motion, keyboard only, actual touch swipes with no input/control hijacking, no instruction reappearing on every next story, optional retry after unreadable image, no image when unavailable and no arrow placeholder. Manual live provider acceptance must inspect actual output for misleading event depiction and record chosen provider/model/attempt; no output was generated during authoring.
