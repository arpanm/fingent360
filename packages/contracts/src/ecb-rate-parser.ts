import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import {
  ECB_RATE_SERIES,
  EcbRateObservationsSchema,
  canonicalEcbRate,
} from './ecb-rates.js';

const text = z.string().max(500);
const Value = z.strictObject({ '@_id': text, '@_value': text });
const Ref = z.strictObject({
  '@_agencyID': z.literal('ECB'),
  '@_id': z.literal('ECB_FM1'),
  '@_version': text,
});
const Header = z.strictObject({
  ID: text,
  Test: z.literal('false'),
  Prepared: z.iso.datetime({ offset: true }),
  Sender: z.strictObject({ '@_id': z.literal('ECB'), Name: text.optional() }),
  Receiver: z.strictObject({ '@_id': text }).optional(),
  Structure: z.strictObject({
    '@_structureID': text,
    '@_dimensionAtObservation': z.literal('TIME_PERIOD'),
    Structure: z.strictObject({ Ref }),
  }),
  DataSetID: text.optional(),
  Extracted: z.iso.datetime({ offset: true }).optional(),
  ReportingBegin: z.string().max(40).optional(),
  ReportingEnd: z.string().max(40).optional(),
});
const Series = z.strictObject({
  SeriesKey: z.strictObject({ Value: z.array(Value).length(7) }),
  Obs: z
    .array(
      z.strictObject({
        ObsDimension: z.strictObject({ '@_value': z.iso.date() }),
        ObsValue: z.strictObject({ '@_value': z.string().max(30) }),
      }),
    )
    .min(1)
    .max(500),
});
const Document = z.strictObject({
  GenericData: z.strictObject({
    Header,
    DataSet: z.strictObject({
      '@_structureRef': text,
      '@_action': z.literal('Replace').optional(),
      '@_validFromDate': z.iso.datetime({ offset: true }).optional(),
      '@_type': z.literal('generic:DataSetType').optional(),
      Series: z.array(Series).length(3),
    }),
  }),
});

/** Fixed SDMX 2.1 data-only response. Metadata and values never become executable XML. */
export function parseEcbRates(body: string) {
  if (!body || body.length > 1000000 || /<!/i.test(body))
    throw Error(
      'ECB rate document is empty, oversized or contains prohibited declarations.',
    );
  const namespaces: Record<string, string> = {
    message: 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message',
    generic: 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic',
    common: 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  };
  const elements = new Set([
    ...[
      'GenericData',
      'Header',
      'ID',
      'Test',
      'Prepared',
      'Sender',
      'Receiver',
      'Structure',
      'DataSetID',
      'Extracted',
      'ReportingBegin',
      'ReportingEnd',
      'DataSet',
    ].map((name) => `message:${name}`),
    'common:Name',
    'common:Structure',
    'Ref',
    ...['Series', 'SeriesKey', 'Value', 'Obs', 'ObsDimension', 'ObsValue'].map(
      (name) => `generic:${name}`,
    ),
  ]);
  let depth = 0,
    tags = 0;
  const bound = new Set<string>();
  // Validate QNames and root-only bindings before namespace removal. Attribute
  // values are tokenized with quotes, so a '>' inside one cannot skip a check.
  for (const match of body.matchAll(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g)) {
    const tag = match[0];
    if (tag.startsWith('<?')) {
      if (match.index !== 0 || !/^<\?xml\s[^?]*\?>$/.test(tag))
        throw Error('Unexpected XML processing instruction.');
      continue;
    }
    if (++tags > 20000)
      throw Error('ECB rate document has too many XML elements.');
    const name = /^<\/?([^\s/>]+)/.exec(tag)?.[1];
    if (
      !name ||
      !elements.has(name) ||
      (tags === 1 && name !== 'message:GenericData')
    )
      throw Error('Unexpected ECB XML element namespace.');
    for (const attribute of tag.matchAll(/\s([^\s=]+)\s*=\s*(["'])(.*?)\2/g)) {
      const key = attribute[1]!,
        value = attribute[3]!;
      if (key === 'xmlns' || key.startsWith('xmlns:')) {
        const prefix = key.slice(6);
        if (tags !== 1 || namespaces[prefix] !== value || bound.has(prefix))
          throw Error('Unexpected or rebound ECB XML namespace.');
        bound.add(prefix);
      } else if (key.includes(':') && (key !== 'xsi:type' || !bound.has('xsi')))
        throw Error('Unexpected ECB XML attribute namespace.');
    }
    const prefix = name.includes(':') ? name.split(':')[0]! : null;
    if (prefix && !bound.has(prefix)) throw Error('Unbound ECB XML namespace.');
    if (tag.startsWith('</')) depth--;
    else if (!tag.endsWith('/>')) depth++;
    if (depth < 0 || depth > 32)
      throw Error('ECB rate XML nesting exceeds its bound.');
  }
  if (
    !bound.has('generic') ||
    !bound.has('message') ||
    depth !== 0 ||
    XMLValidator.validate(body) !== true
  )
    throw Error('Malformed ECB rate XML.');
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: false,
    ignoreDeclaration: true,
    ignorePiTags: true,
    isArray: (name) => ['Series', 'Obs', 'Value'].includes(name),
  });
  let parsed: z.infer<typeof Document>;
  try {
    parsed = Document.parse(parser.parse(body));
  } catch {
    throw Error(
      'ECB rate document fields do not match the accepted data-only schema.',
    );
  }
  const root = parsed.GenericData;
  if (root.DataSet['@_structureRef'] !== root.Header.Structure['@_structureID'])
    throw Error('ECB rate data structure does not match its header.');
  const seen = new Set<string>();
  const observations = root.DataSet.Series.flatMap((series) => {
    const entries = series.SeriesKey.Value;
    const keys = Object.fromEntries(
      entries.map((entry) => [entry['@_id'], entry['@_value']]),
    );
    const expected = {
      FREQ: 'B',
      REF_AREA: 'U2',
      CURRENCY: 'EUR',
      PROVIDER_FM: '4F',
      INSTRUMENT_FM: 'KR',
      DATA_TYPE_FM: 'LEV',
    };
    if (
      Object.keys(keys).length !== 7 ||
      Object.entries(expected).some(([key, value]) => keys[key] !== value) ||
      !ECB_RATE_SERIES.includes(
        keys.PROVIDER_FM_ID as (typeof ECB_RATE_SERIES)[number],
      ) ||
      seen.has(keys.PROVIDER_FM_ID!)
    )
      throw Error('ECB rate series dimensions are unexpected or duplicated.');
    const id = keys.PROVIDER_FM_ID!;
    seen.add(id);
    return series.Obs.map((obs) => ({
      series: id,
      effectiveOn: obs.ObsDimension['@_value'],
      value: canonicalEcbRate(obs.ObsValue['@_value']),
    }));
  });
  return {
    observations: EcbRateObservationsSchema.parse(observations).sort(
      (a, b) =>
        a.series.localeCompare(b.series) ||
        a.effectiveOn.localeCompare(b.effectiveOn),
    ),
    responsePreparedAt: new Date(root.Header.Prepared).toISOString(),
  };
}
