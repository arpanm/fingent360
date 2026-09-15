import { runtime } from './runtime';
import {
  PublicViewContextSchema,
  type FeedItem,
  type MediaAsset,
} from '@fingent360/contracts';
const key = 'fingent360-public-reading-view-v1';
export function rememberPublicView(item: FeedItem, kind: 'reader' | 'story') {
  if (item.status !== 'published') return;
  // Only the public source edition, never account, holdings, goal or rendered DOM data.
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(
        PublicViewContextSchema.parse({
          kind,
          capturedAt: new Date().toISOString(),
          item,
          runtime: runtime.mode,
        }),
      ),
    );
  } catch {
    /* Feedback remains usable without browser storage. */
  }
}
export function currentPublicView() {
  try {
    const parsed = PublicViewContextSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? 'null'),
    );
    if (!parsed.success) return undefined;
    const route = location.hash.slice(1).split('?')[0];
    if (
      route === `read/${parsed.data.item.id}` ||
      (['today', 'explore'].includes(route ?? '') &&
        parsed.data.kind === 'story')
    )
      return parsed.data;
  } catch {
    /* No snapshot inferred from private screens. */
  }
  return undefined;
}

export function clearPublicView() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Reading is independent of evaluation storage. */
  }
}

export function rememberPublicMedia(asset: MediaAsset) {
  if (asset.status !== 'published') return;
  const view = currentPublicView();
  if (
    !view ||
    view.item.id !== asset.itemId ||
    view.item.version !== asset.itemVersion
  )
    return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(
        PublicViewContextSchema.parse({
          ...view,
          media: {
            assetId: asset.id,
            imageAttemptId: asset.image?.attemptId ?? null,
            imageHash: asset.image?.sha256 ?? null,
          },
        }),
      ),
    );
  } catch {
    /* No private data or image bytes are copied. */
  }
}
