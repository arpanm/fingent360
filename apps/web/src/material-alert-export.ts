import {
  MaterialExportSchema,
  CompleteMaterialExportSchema,
  CurrentAccountSchema,
} from '@fingent360/contracts';
export async function completeMaterialExport(
  initial: unknown,
  read: (path: string) => Promise<unknown>,
  active: () => boolean = () => true,
) {
  let page = MaterialExportSchema.parse(initial);
  const ownerId = page.ownerId,
    upper = page.upper,
    events = [...page.events];
  const seen = new Set<string>();
  while (page.next) {
    if (!active() || seen.has(page.next))
      throw Error(
        'Material history export was cancelled or repeated. No partial file was downloaded.',
      );
    seen.add(page.next);
    const after = page.next;
    page = MaterialExportSchema.parse(
      await read(
        '/inbox/material/history?' + new URLSearchParams({ after, upper }),
      ),
    );
    if (
      page.ownerId !== ownerId ||
      page.upper !== upper ||
      page.events.some((e) => BigInt(e.sequence) <= BigInt(after))
    )
      throw Error(
        'Account or material history boundary changed. No partial file was downloaded.',
      );
    events.push(...page.events);
  }
  if ((events.at(-1)?.sequence ?? '0') !== upper)
    throw Error(
      'Material history ended before its retained boundary. No partial file was downloaded.',
    );
  const account = CurrentAccountSchema.parse(await read(''));
  if (!active() || account.user?.id !== ownerId)
    throw Error('Account changed. No partial file was downloaded.');
  return CompleteMaterialExportSchema.parse({
    ownerId,
    events,
    complete: true,
  });
}
