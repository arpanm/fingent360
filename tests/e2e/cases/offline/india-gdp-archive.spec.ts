import { test, expect } from '@playwright/test';
import { indiaGdpInput } from '../../helpers/india-gdp';
import { parseIndiaGdpRelease } from '../../../../apps/api/src/india-gdp-provider';
import {
  IndiaGdpPublicEditionSchema,
  selectIndiaGdp,
} from '../../../../packages/contracts/src/index';
import { handleIndiaMacro } from '../../../../apps/web/src/offline/india-macro';
test('E2E-OFFLINE-1790 archived GDP cutoff and offline Operations denial preserve original time @SRC-007 @TEST-SIMULATION', async () => {
  const input = indiaGdpInput();
  input.releaseUrl =
    'https://archive.pib.gov.in/archive2/erelcontent.aspx?relid=294102';
  input.releaseHtml = input.releaseHtml.replace(
    /<h2>(.*?)<\/h2>Posted On: 31 AUG 2026 4:00PM by PIB Delhi/,
    '<div id="ministry">Ministry of Statistics &amp; Programme Implementation<span>31-August, 2026 16:00 IST</span></div><div align="center">$1<br>synthetic</div>',
  );
  const at = '2026-09-01T00:00:00.000Z';
  const edition = IndiaGdpPublicEditionSchema.parse({
    ...parseIndiaGdpRelease(input.releaseHtml, input.releaseUrl, at),
    id: input.requestId,
    parser: 'mospi-pib-quarterly-real-gdp-v1',
    hash: 'a'.repeat(64),
    retrievedAt: at,
  });
  const old = IndiaGdpPublicEditionSchema.parse({
    ...edition,
    id: '10000000-0000-4000-8000-000000000001',
    point: { ...edition.point, baseYear: '2011-12' },
  });
  expect(selectIndiaGdp([edition, old], null)).toHaveLength(2);
  const bundle = {
    generatedAt: at,
    feed: [],
    histories: {},
    evidence: {},
    macro: null,
    macroHistory: {},
    macroEvidence: {},
    sources: null,
    learningCatalog: null,
    journeyCatalog: null,
    media: {},
    indiaMacro: {
      cpi: { capturedAt: at, asOf: null, editions: [], selected: [] },
      calendar: null,
      calendarHistory: [],
      gdp: { editions: [edition], selected: [] },
    },
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/india-macro',
    method: 'GET',
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect((await handleIndiaMacro(request, state, bundle))?.body).toMatchObject({
    gdp: { selected: [edition] },
  });
  expect(
    (
      await handleIndiaMacro(
        {
          ...request,
          query: new URLSearchParams({ asOf: '2026-08-31T10:29:59.000Z' }),
        },
        state,
        bundle,
      )
    )?.body,
  ).toMatchObject({ gdp: { selected: [] } });
  expect(
    (
      await handleIndiaMacro(request, state, {
        ...bundle,
        indiaMacro: {
          ...bundle.indiaMacro,
          gdp: { editions: [], selected: [edition] },
        },
      })
    )?.body,
  ).toMatchObject({ gdp: { selected: [] } });
  expect(() =>
    handleIndiaMacro(
      {
        ...request,
        path: '/api/v1/ops/india-macro/gdp-archive',
        method: 'POST',
      },
      state,
      bundle,
    ),
  ).toThrow('connected Operations');
});
