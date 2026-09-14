import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import {
  EcbFxObservationsSchema,
  EcbFxSourceValueSchema,
  deriveEcbFx,
  type EcbFxObservation,
} from './ecb-fx.js';

const Currency = z.strictObject({
  '@_currency': z.string().regex(/^[A-Z]{3}$/),
  '@_rate': EcbFxSourceValueSchema,
});
const Day = z.strictObject({
  '@_time': z.iso.date(),
  Cube: z.array(Currency).min(2).max(60),
});
const Document = z.strictObject({
  Envelope: z.strictObject({
    subject: z.literal('Reference rates'),
    Sender: z.strictObject({ name: z.literal('European Central Bank') }),
    Cube: z
      .array(z.strictObject({ Cube: z.array(Day).min(1).max(92) }))
      .length(1),
  }),
});
const namespaces: Record<string, string> = {
  'xmlns:gesmes': 'http://www.gesmes.org/xml/2002-08-01',
  xmlns: 'http://www.ecb.int/vocabulary/2002-08-01/eurofxref',
};
const names = new Set([
  'gesmes:Envelope',
  'gesmes:subject',
  'gesmes:Sender',
  'gesmes:name',
  'Cube',
]);
const attributePattern = /\s([^\s=]+)\s*=\s*(["'])([^]*?)\2/g;

/** Fixed observed eurofxref XML profile. No XML entities, executable content or external resolution. */
export function parseEcbFx(body: string): { observations: EcbFxObservation[] } {
  if (
    !body ||
    body.length > 1000000 ||
    new TextEncoder().encode(body).byteLength > 1000000
  )
    throw Error('ECB FX document is empty or exceeds the UTF-8 byte bound.');
  // An optional UTF-8 BOM is transport syntax. The caller retains and hashes
  // its original body; source decimal strings are never normalized here.
  const xml = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (/<!|&/.test(xml))
    throw Error(
      'ECB FX declarations, entities and invalid XML characters are prohibited.',
    );
  for (const character of xml) {
    const code = character.codePointAt(0)!;
    if (
      (code < 32 && code !== 9 && code !== 10 && code !== 13) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfffe ||
      code === 0xffff
    )
      throw Error('ECB FX contains an invalid XML character.');
  }
  let tags = 0,
    depth = 0;
  const bound = new Set<string>();
  // Check raw qualified names and raw attribute values before namespace removal
  // or whitespace normalization. Quoted '>' cannot hide a namespace declaration.
  for (const match of xml.matchAll(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g)) {
    const tag = match[0];
    if (tag.startsWith('<?')) {
      if (match.index !== 0 || !/^<\?xml\s[^?]*\?>$/.test(tag))
        throw Error('Unexpected ECB FX processing instruction.');
      const attributes = [...tag.matchAll(attributePattern)];
      const values = Object.fromEntries(
        attributes.map((value) => [value[1]!, value[3]!]),
      );
      if (
        attributes.length !== Object.keys(values).length ||
        values.version !== '1.0' ||
        Object.keys(values).some(
          (key) => !['version', 'encoding', 'standalone'].includes(key),
        ) ||
        (values.encoding !== undefined && values.encoding !== 'UTF-8') ||
        (values.standalone !== undefined &&
          !['yes', 'no'].includes(values.standalone))
      )
        throw Error('Unsupported ECB FX XML declaration.');
      continue;
    }
    if (++tags > 20000)
      throw Error('ECB FX document exceeds the XML tag bound.');
    const name = /^<\/?([^\s/>]+)/.exec(tag)?.[1];
    if (
      !name ||
      !names.has(name) ||
      (tags === 1 && (name !== 'gesmes:Envelope' || tag.startsWith('</')))
    )
      throw Error('Unexpected ECB FX element or namespace.');
    const attributes = [...tag.matchAll(attributePattern)],
      seen = new Set<string>();
    for (const attribute of attributes) {
      const key = attribute[1]!,
        value = attribute[3]!;
      if (seen.has(key)) throw Error('Duplicate ECB FX attribute.');
      seen.add(key);
      if (key === 'xmlns' || key.startsWith('xmlns:')) {
        if (tags !== 1 || namespaces[key] !== value || bound.has(key))
          throw Error('Unexpected or rebound ECB FX namespace.');
        bound.add(key);
      } else {
        if (name !== 'Cube' || !['time', 'currency', 'rate'].includes(key))
          throw Error('Unexpected ECB FX attribute.');
        if (
          (key === 'time' && !z.iso.date().safeParse(value).success) ||
          (key === 'currency' && !/^[A-Z]{3}$/.test(value)) ||
          (key === 'rate' && !EcbFxSourceValueSchema.safeParse(value).success)
        )
          throw Error('Invalid unchanged ECB FX date, currency or decimal.');
      }
    }
    if (!bound.has('xmlns:gesmes') || !bound.has('xmlns'))
      throw Error('Missing fixed ECB FX root namespaces.');
    if (tag.startsWith('</')) depth--;
    else if (!tag.endsWith('/>')) depth++;
    if (depth < 0 || depth > 32)
      throw Error('ECB FX XML nesting exceeds its bound.');
  }
  if (!tags || depth !== 0 || XMLValidator.validate(xml) !== true)
    throw Error('Malformed ECB FX XML.');
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: false,
    ignoreDeclaration: true,
    ignorePiTags: true,
    isArray: (name) => name === 'Cube',
  });
  let parsed: z.infer<typeof Document>;
  try {
    parsed = Document.parse(parser.parse(xml));
  } catch {
    throw Error(
      'ECB FX document fields do not match the accepted source schema.',
    );
  }
  const seenDates = new Set<string>();
  const observations = parsed.Envelope.Cube[0]!.Cube.map((day) => {
    const date = day['@_time'];
    if (seenDates.has(date)) throw Error('Duplicate ECB FX observation date.');
    seenDates.add(date);
    const currencies = new Map<string, string>();
    for (const currency of day.Cube) {
      const code = currency['@_currency'];
      if (currencies.has(code))
        throw Error('Duplicate ECB FX currency on an observation date.');
      currencies.set(code, currency['@_rate']);
    }
    const usdPerEur = currencies.get('USD'),
      inrPerEur = currencies.get('INR');
    if (!usdPerEur || !inrPerEur)
      throw Error('Each ECB FX observation date requires both USD and INR.');
    return {
      date,
      usdPerEur,
      inrPerEur,
      derivedInrPerUsd: deriveEcbFx(usdPerEur, inrPerEur),
    };
  });
  // Retrieval-relative future-date admission is enforced by EcbFxEditionSchema.
  return {
    observations: EcbFxObservationsSchema.parse(observations).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  };
}
