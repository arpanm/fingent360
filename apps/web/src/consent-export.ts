import {
  ConsentPrivacySchema,
  ConsentExportSchema,
  CompleteConsentPrivacySchema,
  CurrentAccountSchema,
} from '@fingent360/contracts';
export async function completeConsentExport(
  initial: unknown,
  read: (path: string) => Promise<unknown>,
  active: () => boolean = () => true,
) {
  const initialExport = ConsentPrivacySchema.parse(initial);
  let page = initialExport.history;
  const ownerId = page.ownerId,
    upper = page.upper,
    events = [...page.events],
    seen = new Set<string>();
  while (page.next) {
    if (!active() || seen.has(page.next))
      throw Error(
        'Consent export was cancelled or repeated. No partial file was downloaded.',
      );
    const after = page.next;
    seen.add(after);
    page = ConsentExportSchema.parse(
      await read('/consents/history?' + new URLSearchParams({ after, upper })),
    );
    if (
      page.ownerId !== ownerId ||
      page.upper !== upper ||
      page.events.some((e) => BigInt(e.sequence) <= BigInt(after))
    )
      throw Error(
        'Account or consent history boundary changed. No partial file was downloaded.',
      );
    events.push(...page.events);
  }
  const account = CurrentAccountSchema.parse(await read(''));
  if (!active() || account.user?.id !== ownerId)
    throw Error('Account changed. No partial file was downloaded.');
  return CompleteConsentPrivacySchema.parse({
    current: initialExport.current,
    history: { ownerId, upper, events, complete: true },
  });
}
