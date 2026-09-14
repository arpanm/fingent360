import {
  ReadingFollowExportSchema,
  CompleteReadingFollowExportSchema,
  CurrentAccountSchema,
} from '@fingent360/contracts';
export async function completeReadingFollowExport(
  initial: unknown,
  read: (path: string) => Promise<unknown>,
  active: () => boolean = () => true,
) {
  let page = ReadingFollowExportSchema.parse(initial);
  const ownerId = page.ownerId,
    upper = page.upper,
    events = [...page.events],
    seen = new Set<string>();
  while (page.next) {
    if (!active())
      throw Error('Export cancelled; no partial file was downloaded.');
    if (seen.has(page.next)) throw Error('Export cursor repeated. Retry.');
    seen.add(page.next);
    page = ReadingFollowExportSchema.parse(
      await read(
        '/reading-follow/export?' +
          new URLSearchParams({ after: page.next, upper }),
      ),
    );
    if (page.ownerId !== ownerId || page.upper !== upper)
      throw Error(
        'Account or export boundary changed. No file was downloaded.',
      );
    events.push(...page.events);
  }
  const account = CurrentAccountSchema.parse(await read(''));
  if (!active() || account.user?.id !== ownerId)
    throw Error('Account changed or export cancelled. No file was downloaded.');
  return CompleteReadingFollowExportSchema.parse({
    ownerId,
    events,
    complete: true,
  });
}
