import {
  CurrentAccountSchema,
  ScheduleExportSchema,
  CompleteScheduleExportSchema,
} from '@fingent360/contracts';
/** The upper cursors freeze the first page's boundary. Never download a partially fetched artifact. */
export async function completeScheduleExport(
  initial: unknown,
  read: (path: string) => Promise<unknown>,
  active: () => boolean = () => true,
) {
  let page = ScheduleExportSchema.parse(initial);
  const ownerId = page.ownerId,
    editions = [...page.editions],
    receipts = [...page.receipts],
    occurrences = [...page.occurrences];
  const seen = new Set<string>();
  while (page.next) {
    if (!active())
      throw new Error('Export cancelled. No partial file was downloaded.');
    const cursor = JSON.stringify(page.next);
    if (seen.has(cursor))
      throw new Error(
        'Export cursor did not advance. Retry the complete export.',
      );
    seen.add(cursor);
    page = ScheduleExportSchema.parse(
      await read(
        `/report-schedules/export?${new URLSearchParams(Object.entries(page.next).map(([k, v]) => [k, String(v)]))}`,
      ),
    );
    if (page.ownerId !== ownerId)
      throw new Error('Account changed during export. No file was downloaded.');
    editions.push(...page.editions);
    receipts.push(...page.receipts);
    occurrences.push(...page.occurrences);
  }
  if (!active()) throw new Error('Export cancelled.');
  const current = CurrentAccountSchema.parse(await read(''));
  if (current.user?.id !== ownerId || !active())
    throw new Error(
      'Account changed or export was cancelled. No file was downloaded.',
    );
  return CompleteScheduleExportSchema.parse({
    ownerId,
    editions,
    receipts,
    occurrences,
    complete: true,
  });
}
