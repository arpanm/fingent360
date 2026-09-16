import { createHash } from 'node:crypto';
import { plain } from './discovery-provider.js';
const INDEX = 'https://archive.pib.gov.in/archive2/erelease.aspx';
const digest = (body: string) =>
  createHash('sha256').update(body).digest('hex');
export function parsePibArchiveMetadata(body: string) {
  const ministry = body.match(
    /<div\b[^>]*id=["']ministry["'][^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  if (!ministry || !/Ministry of Statistics/i.test(plain(ministry)))
    throw Error('Archive ministry is not verified MoSPI.');
  const date = plain(ministry).match(
    /(\d{1,2})-([A-Za-z]+),\s*(20\d{2})\s+(\d{2}):(\d{2})\s+IST/,
  );
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  if (!date) throw Error('Archive publication timestamp unavailable.');
  const m = months.indexOf(date[2]!);
  const day = Number(date[1]),
    year = Number(date[3]),
    hour = Number(date[4]),
    minute = Number(date[5]);
  if (
    m < 0 ||
    day < 1 ||
    day > new Date(Date.UTC(year, m + 1, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59
  )
    throw Error('Invalid archive publication timestamp.');
  const titles = [
    ...body.matchAll(
      /<div\b[^>]*align=["']center["'][^>]*>([\s\S]*?)<\/div>/gi,
    ),
  ]
    .map((match) => plain(match[1]!.split(/<br\b/i)[0]!))
    .filter((title) =>
      /QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT/i.test(title),
    );
  if (titles.length !== 1)
    throw Error('Archive quarterly GDP title missing or ambiguous.');
  return {
    title: titles[0]!,
    publishedAt: new Date(
      Date.UTC(year, m, day, hour, minute) - 330 * 60000,
    ).toISOString(),
  };
}
export function archiveCandidates(body: string) {
  if (
    !body.startsWith('0|1~') ||
    !/Min of Statistics &amp; Programme Implementation|Min of Statistics & Programme Implementation/.test(
      body,
    )
  )
    throw Error('Archive callback format/ministry changed.');
  const links = new Set<string>();
  for (const item of body.matchAll(
    /<button\b[^>]*id=['"](\d{5,12})['"][^>]*>([\s\S]*?)<\/button>/gi,
  ))
    if (/QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT/i.test(plain(item[2]!)))
      links.add(
        'https://archive.pib.gov.in/archive2/erelcontent.aspx?relid=' + item[1],
      );
  if (links.size > 8)
    throw Error(
      'Archive returned more than eight GDP releases; inspect source before proceeding.',
    );
  return [...links];
}
async function original(url: string, body?: URLSearchParams) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    ...(body === undefined ? {} : { body }),
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.body)
    throw Error('PIB archive original unavailable.');
  const reader = response.body.getReader();
  let text = '',
    size = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2000000) throw Error('PIB archive original exceeds 2 MB.');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    await reader.cancel();
  }
}
export async function fetchIndiaGdpArchive(month: string) {
  if (
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ||
    month > new Date().toISOString().slice(0, 7)
  )
    throw Error('Choose an elapsed or current calendar month.');
  const landing = await original(INDEX);
  if (!landing.includes('rmonthID') || !landing.includes('minID'))
    throw Error('PIB archive selection form changed.');
  const fields = new URLSearchParams();
  for (const input of landing.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = new Map(
      [...input[0].matchAll(/([\w]+)=["']([^"']*)["']/g)].map((m) => [
        m[1]!,
        m[2]!,
      ]),
    );
    if (
      attributes.get('type') === 'hidden' &&
      attributes.get('name')?.startsWith('__')
    )
      fields.set(attributes.get('name')!, attributes.get('value') ?? '');
  }
  if (!fields.has('__VIEWSTATE')) throw Error('PIB archive state unavailable.');
  const [year, monthNumber] = month.split('-');
  fields.set('__CALLBACKID', '__Page');
  fields.set('__CALLBACKPARAM', `1|0|${Number(monthNumber)}|${year}|55`);
  fields.set('minname', '55');
  fields.set('rdate', '0');
  fields.set('rmonth', String(Number(monthNumber)));
  fields.set('ryear', year!);
  const callback = await original(INDEX, fields),
    retrievedAt = new Date().toISOString(),
    indexHash = digest(callback),
    releases = [],
    failures: { url: string; reason: string }[] = [];
  for (const url of archiveCandidates(callback)) {
    try {
      const html = await original(url);
      releases.push({ url, html });
    } catch {
      failures.push({
        url,
        reason:
          'Original release could not be retrieved completely; retry this month.',
      });
    }
  }
  return {
    month,
    indexUrl: INDEX,
    indexHash,
    retrievedAt,
    callback,
    releases,
    failures,
  };
}
