import { z } from 'zod';
import { AMFI_HISTORY_CATALOG } from './amfi-history-catalog.js';
export { AMFI_HISTORY_CATALOG } from './amfi-history-catalog.js';

export const AMFI_HISTORY_BASE =
  'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx';
export const AMFI_HISTORY_HEADER =
  'Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date';
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
function sourceDay(value: string) {
  const match = /^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/.exec(value);
  if (!match) throw Error('AMFI history dates must use DD-MMM-YYYY.');
  const month = months.indexOf(match[2]!);
  if (month < 0) throw Error('Invalid history month.');
  return z.iso
    .date()
    .parse(`${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1]}`);
}
export function amfiHistoryWindow(value: string) {
  const url = new URL(value);
  if (
    url.origin + url.pathname !== AMFI_HISTORY_BASE ||
    url.hash ||
    url.username ||
    url.password
  )
    throw Error('Use the official current AMFI history report URL.');
  const keys = [...url.searchParams.keys()].sort();
  const amcCode = url.searchParams.get('mf'),
    typeCode = url.searchParams.get('tp');
  const amc =
    amcCode === null
      ? null
      : AMFI_HISTORY_CATALOG.amcs.find((item) => item.code === amcCode);
  const type =
    typeCode === null
      ? null
      : AMFI_HISTORY_CATALOG.types.find((item) => item.code === typeCode);
  const expected = [
    'frmdt',
    ...(amcCode === null ? [] : ['mf', 'todt']),
    ...(typeCode === null ? [] : ['tp']),
  ].sort();
  if (
    keys.join(',') !== expected.join(',') ||
    amc === undefined ||
    type === undefined
  )
    throw Error(
      'Use only published AMFI form identifiers and exact report query fields.',
    );
  const from = sourceDay(url.searchParams.get('frmdt')!);
  const to = amcCode === null ? from : sourceDay(url.searchParams.get('todt')!);
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (days < 1 || days > 90)
    throw Error('Choose a history interval of 1 to 90 calendar days.');
  return {
    from,
    to,
    amc: amc?.name ?? null,
    categoryPrefix: type?.categoryPrefix ?? null,
  };
}
export const AmfiHistoryUrlSchema = z
  .string()
  .max(600)
  .superRefine((value, ctx) => {
    try {
      amfiHistoryWindow(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message:
          error instanceof Error ? error.message : 'Invalid history URL.',
      });
    }
  });

export function amfiHistoryUrl(
  amcCode: string,
  typeCode: string,
  from: string,
  to: string,
) {
  const format = (day: string) => {
    const parsed = z.iso.date().parse(day);
    return `${parsed.slice(8)}-${months[Number(parsed.slice(5, 7)) - 1]}-${parsed.slice(0, 4)}`;
  };
  const url = new URL(AMFI_HISTORY_BASE);
  if (amcCode) url.searchParams.set('mf', amcCode);
  url.searchParams.set('frmdt', format(from));
  if (amcCode) url.searchParams.set('todt', format(to));
  if (typeCode) url.searchParams.set('tp', typeCode);
  return AmfiHistoryUrlSchema.parse(url.toString());
}
export function amfiHistoryRowMatches(
  window: ReturnType<typeof amfiHistoryWindow>,
  amc: string,
  category: string,
) {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const allowedAmc = window.amc
    ? normalize(amc) === normalize(window.amc)
    : AMFI_HISTORY_CATALOG.amcs.some(
        (item) => normalize(item.name) === normalize(amc),
      );
  const allowedType = window.categoryPrefix
    ? category.startsWith(window.categoryPrefix + ' (')
    : AMFI_HISTORY_CATALOG.types.some((item) =>
        category.startsWith(item.categoryPrefix + ' ('),
      );
  return allowedAmc && allowedType;
}
