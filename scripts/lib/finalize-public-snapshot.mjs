import {
  PublicationManifestSchema,
  FeedItemSchema,
  MediaAssetSchema,
  publicEdition,
  editionEvidence,
} from '../../packages/contracts/dist/index.js';

/** No I/O on import. The caller obtains this manifest after collecting all public responses. */
export function finalizePublicSnapshot(bundle, input) {
  const manifest = PublicationManifestSchema.parse(input);
  const current = new Map(manifest.items.map((v) => [v.id, v]));
  const feed = bundle.feed
    .map((v) => FeedItemSchema.parse(v))
    .filter((item) => {
      const admitted = current.get(item.id);
      if (!admitted) return false;
      if (admitted.version !== item.version)
        throw new Error(
          'Publication changed during snapshot export. Retry; the existing bundle is unchanged.',
        );
      return item.status === 'published';
    });
  const histories = {},
    evidence = {},
    media = {};
  for (const item of feed) {
    histories[item.id] = (bundle.histories[item.id] ?? [item])
      .map((v) => FeedItemSchema.parse(v))
      .filter((v) => v.status !== 'draft')
      .map((v) => publicEdition(v));
    if (bundle.evidence[item.id])
      evidence[item.id] = editionEvidence(item, bundle.evidence[item.id]);
    const asset =
      bundle.media[item.id] && MediaAssetSchema.parse(bundle.media[item.id]);
    if (
      asset &&
      asset.itemId === item.id &&
      asset.id === current.get(item.id).mediaId &&
      asset.itemVersion === item.version &&
      asset.status === 'published'
    ) {
      const admittedImage = current.get(item.id).imageAttemptId;
      if (asset.image && asset.image.attemptId !== admittedImage) {
        const captionsOnly = { ...asset };
        delete captionsOnly.image;
        media[item.id] = captionsOnly;
      } else {
        media[item.id] = asset;
      }
    }
  }
  return {
    ...bundle,
    generatedAt: manifest.admittedAt,
    feed,
    histories,
    evidence,
    media,
  };
}
