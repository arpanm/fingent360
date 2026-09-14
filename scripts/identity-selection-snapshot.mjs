import {
  selectionMatchesProvider,
  IdentitySelectionPublicSchema,
  IdentitySelectionHistorySchema,
} from '../packages/contracts/dist/index.js';
export async function captureIdentitySelections(get, directory) {
  const identitySelections = {},
    identitySelectionHistories = {};
  for (const provider of directory.items) {
    const path = '/securities/' + provider.isin + '/selection';
    const current = IdentitySelectionPublicSchema.parse(await get(path));
    if (current.isin !== provider.isin)
      throw Error('Wrong identity selection returned.');
    if (
      current.state === 'current' &&
      !selectionMatchesProvider(current.receipt, provider)
    )
      throw Error('Provider changed during selection capture. Retry.');
    const receipts = [];
    let before;
    do {
      const page = IdentitySelectionHistorySchema.parse(
        await get(path + '/history' + (before ? '?before=' + before : '')),
      );
      if (page.receipts.some((receipt) => receipt.isin !== provider.isin))
        throw Error('Wrong selection history identity.');
      receipts.push(...page.receipts);
      if (receipts.length > 1000)
        throw Error(
          'Selection history exceeds snapshot capacity; no partial snapshot saved.',
        );
      if (page.nextBefore && before && page.nextBefore >= before)
        throw Error('Selection history did not advance.');
      before = page.nextBefore;
    } while (before);
    const final = IdentitySelectionPublicSchema.parse(await get(path));
    if (
      JSON.stringify({ state: current.state, receipt: current.receipt }) !==
        JSON.stringify({ state: final.state, receipt: final.receipt }) ||
      final.isin !== provider.isin
    )
      throw Error('Selection changed during capture. Retry.');
    identitySelections[provider.isin] = final;
    identitySelectionHistories[provider.isin] = receipts;
  }
  return { identitySelections, identitySelectionHistories };
}
