import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  SourceListSchema,
  SourceRecordSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-070 registry revisions, publication and authorization @SOURCES-001', async ({
  request,
}) => {
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
    Authorization: `Bearer ${await operatorKey()}`,
  };
  const data = {
    name: `Synthetic registry fixture ${randomUUID()}`,
    category: 'Test fixture; not a provider',
    sourceUrl: 'https://example.com/source',
    termsUrl: 'https://example.com/terms',
    constraints: 'Synthetic metadata only; never ingest.',
    reviewEvidence: '',
    reviewedAt: null,
    rightsStatus: 'unreviewed',
    published: false,
  };
  expect((await request.post('/api/v1/sources', { data })).status()).toBe(401);
  expect((await request.get('/api/v1/sources/operator')).status()).toBe(401);
  for (const invalid of [
    { ...data, published: true },
    { ...data, sourceUrl: 'javascript:alert(1)' },
    { ...data, arbitrary: true },
  ])
    expect(
      (
        await request.post('/api/v1/sources', { headers, data: invalid })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post('/api/v1/sources', {
        headers: { ...headers, Origin: 'https://example.com' },
        data,
      })
    ).status(),
  ).toBe(403);
  const created = await request.post('/api/v1/sources', { headers, data });
  expect(created.status(), await created.text()).toBe(201);
  const source = SourceRecordSchema.parse(await created.json());
  expect(
    SourceListSchema.parse(
      await (await request.get('/api/v1/sources')).json(),
    ).some((s) => s.id === source.id),
  ).toBe(false);
  const published = {
    ...data,
    rightsStatus: 'approved',
    published: true,
    reviewEvidence: 'Synthetic acceptance fixture; no real rights approval.',
    reviewedAt: new Date().toISOString(),
  };
  try {
    const updated = await request.put(`/api/v1/sources/${source.id}`, {
      headers,
      data: { expectedRevision: 1, data: published },
    });
    expect(updated.status()).toBe(200);
    expect(SourceRecordSchema.parse(await updated.json()).revision).toBe(2);
    expect(
      (
        await request.put(`/api/v1/sources/${source.id}`, {
          headers,
          data: { expectedRevision: 1, data },
        })
      ).status(),
    ).toBe(409);
    expect(
      SourceListSchema.parse(
        await (await request.get('/api/v1/sources')).json(),
      ).some((s) => s.id === source.id),
    ).toBe(true);
    const history = SourceListSchema.parse(
      await (
        await request.get(`/api/v1/sources/${source.id}/history`, { headers })
      ).json(),
    );
    expect(history.map((s) => s.revision)).toEqual([2, 1]);
    expect(history[1]?.data).toEqual(data);
  } finally {
    const latest = SourceListSchema.parse(
      await (
        await request.get(`/api/v1/sources/${source.id}/history`, { headers })
      ).json(),
    )[0]!;
    expect(
      (
        await request.put(`/api/v1/sources/${source.id}`, {
          headers,
          data: { expectedRevision: latest.revision, data },
        })
      ).status(),
    ).toBe(200);
  }
  expect(
    SourceListSchema.parse(
      await (await request.get('/api/v1/sources')).json(),
    ).some((s) => s.id === source.id),
  ).toBe(false);
});
