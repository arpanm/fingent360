import { z } from 'zod';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
export const FILING_DISCOVERY_URL =
  'https://nsearchives.nseindia.com//content/RSS/Integrated_Filing_Financials.xml';
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const literalDate = z
  .string()
  .regex(/^\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2}$/)
  .superRefine((value, c) => {
    const m = /^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(
      value,
    );
    if (!m) return;
    const month =
        [
          'jan',
          'feb',
          'mar',
          'apr',
          'may',
          'jun',
          'jul',
          'aug',
          'sep',
          'oct',
          'nov',
          'dec',
        ].indexOf(m[2]!.toLowerCase()) + 1,
      date = `${m[3]}-${String(month).padStart(2, '0')}-${m[1]}`;
    if (
      !month ||
      !z.iso.date().safeParse(date).success ||
      Number(m[4]) > 23 ||
      Number(m[5]) > 59 ||
      Number(m[6]) > 59
    )
      c.addIssue({ code: 'custom', message: 'Invalid literal source date.' });
  });
export const FilingDiscoveryItemSchema = z.strictObject({
  companyTitle: z.string().trim().min(1).max(300),
  originalUrl: z
    .string()
    .regex(
      /^https:\/\/nsearchives\.nseindia\.com\/corporate\/xbrl\/INTEGRATED_FILING_[A-Z_]+_\d+_\d{14}_WEB\.xml$/,
    ),
  submission: z.enum(['Original', 'Revision']),
  revisionRemark: z.string().max(3000),
  publishedLiteral: literalDate,
  timezone: z.literal('unknown'),
  identityStatus: z.literal('unmapped'),
  financialStatus: z.literal('original-XML-not-parsed'),
});
export const FilingDiscoveryGateSchema = z
  .strictObject({
    enabled: z.boolean(),
    rightsEvidence: z.string().trim().max(3000),
  })
  .refine(
    (v) => !v.enabled || v.rightsEvidence.length >= 30,
    'Record source retention and internal display permission.',
  );
export const FilingDiscoveryInputSchema = z.strictObject({
  requestId: z.uuid(),
  body: z
    .string()
    .min(1)
    .max(2_000_000)
    .refine(
      (v) => new TextEncoder().encode(v).byteLength <= 2_000_000,
      'Original RSS exceeds2MB.',
    ),
});
export const FilingDiscoveryFetchSchema = z.strictObject({
  requestId: z.uuid(),
});
export const FilingDiscoveryCaptureSchema = z.strictObject({
  id: z.uuid(),
  bodyHash: Hash,
  status: z.enum(['retained', 'quarantined']),
  itemCount: z.number().int().min(0).max(2000),
  message: z.string(),
  capturedAt: z.iso.datetime(),
});
export const FilingDiscoveryInboxSchema = z.strictObject({
  gate: FilingDiscoveryGateSchema,
  items: z
    .array(
      z.strictObject({
        id: Hash,
        item: FilingDiscoveryItemSchema,
        captureId: z.uuid(),
        observedAt: z.iso.datetime(),
      }),
    )
    .max(20),
  next: Hash.nullable(),
  captures: z.array(FilingDiscoveryCaptureSchema).max(20),
  captureNext: z.uuid().nullable(),
});
export function parseFilingDiscovery(body: string) {
  if (
    BufferlessBytes(body) > 2_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(body) ||
    XMLValidator.validate(body) !== true
  )
    throw Error('Malformed or unsupported RSS original.');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true,
  }).parse(body);
  const channel = parsed?.rss?.channel;
  if (
    channel &&
    Object.keys(channel).some(
      (k) =>
        ![
          'atom:link',
          'link',
          'title',
          'description',
          'language',
          'lastBuildDate',
          'ttl',
          'image',
          'item',
        ].includes(k),
    )
  )
    throw Error('Unexpected original RSS channel fields.');
  if (
    parsed?.rss?.['@_version'] !== '2.0' ||
    !channel ||
    channel.title !== 'NSE News - Latest INTEGRATED_FILING_FINANCIALS' ||
    channel.link !==
      'https://www.nseindia.com/companies-listing/corporate-integrated-filing'
  )
    throw Error('Expected official integrated-financials RSS2.0 channel.');
  const items =
    channel.item === undefined
      ? []
      : Array.isArray(channel.item)
        ? channel.item
        : [channel.item];
  if (items.length > 2000) throw Error('Too many original filing entries.');
  const seen = new Set<string>();
  return items.map((raw: unknown) => {
    const source = z
        .strictObject({
          title: z.string(),
          link: z.string(),
          description: z.string(),
          pubDate: z.string(),
        })
        .parse(raw),
      parts = source.description.split('|');
    if (parts.shift() !== 'Integrated Filing- Financials')
      throw Error('Unexpected filing family.');
    const submission = parts.shift(),
      revisionRemark = parts.join('|');
    const item = FilingDiscoveryItemSchema.parse({
        companyTitle: source.title,
        originalUrl: source.link,
        submission,
        revisionRemark,
        publishedLiteral: source.pubDate,
        timezone: 'unknown',
        identityStatus: 'unmapped',
        financialStatus: 'original-XML-not-parsed',
      }),
      key = JSON.stringify(item);
    if (seen.has(key)) throw Error('Duplicate original filing entry.');
    seen.add(key);
    return item;
  });
}
function BufferlessBytes(body: string) {
  return new TextEncoder().encode(body).byteLength;
}
