import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  AssistanceOptionsSchema,
  AssistanceResultSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-150 query assistance respects auth origin history and ownership @ASSIST-001', async ({
  request,
  playwright,
  baseURL,
}) => {
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    expect(
      (await request.get('/api/v1/account/assistance/options')).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `e2e_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await other.post('/api/v1/account/register', {
          headers,
          data: {
            username: `e2e_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    const optionsResponse = await request.get(
      '/api/v1/account/assistance/options',
    );
    expect(optionsResponse.status()).toBe(200);
    const options = AssistanceOptionsSchema.parse(await optionsResponse.json());
    expect(options.privateContextConsent?.status).toBe('not-granted');
    expect(await optionsResponse.text()).not.toMatch(
      /API_KEY|password_hash|token_hash/,
    );
    const data = {
      query: 'monthly contribution',
      provider: 'query',
      scope: 'goals',
      useHistory: false,
    };
    expect(
      (
        await request.post('/api/v1/account/assistance', {
          headers: { Origin: 'https://evil.example' },
          data,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post('/api/v1/account/assistance', {
          headers,
          data: { ...data, userId: randomUUID() },
        })
      ).status(),
    ).toBe(400);
    const response = await request.post('/api/v1/account/assistance', {
      headers,
      data,
    });
    expect(response.status()).toBe(200);
    const result = AssistanceResultSchema.parse(await response.json());
    expect(result.provider).toBe('query');
    expect(result.usedHistory).toBe(false);
    expect(
      result.suggestions.some((value) => value.source.id === 'field-monthly'),
    ).toBe(true);
    const name = `Private ${randomUUID().slice(0, 8)} education`;
    expect(
      (
        await request.post('/api/v1/account/goals', {
          headers,
          data: {
            name,
            type: 'education',
            targetMinor: '100000',
            savedMinor: '0',
            monthlyMinor: '100',
            horizonMonths: 12,
            currency: 'INR',
            scale: 2,
            assumptions: 'no-growth-nominal-v1',
            storageConsent: true,
          },
        })
      ).status(),
    ).toBe(201);
    const own = AssistanceResultSchema.parse(
      await (
        await request.post('/api/v1/account/assistance', {
          headers,
          data: { ...data, query: name, useHistory: true },
        })
      ).json(),
    );
    expect(own.usedHistory).toBe(true);
    // Query-based own-record assistance does not require an external-sharing grant.
    expect(
      AssistanceOptionsSchema.parse(
        await (await request.get('/api/v1/account/assistance/options')).json(),
      ).privateContextConsent?.status,
    ).toBe('not-granted');
    expect(
      own.suggestions.some(
        (value) => value.text === name && value.source.private,
      ),
    ).toBe(true);
    const noConsent = AssistanceResultSchema.parse(
      await (
        await request.post('/api/v1/account/assistance', {
          headers,
          data: { ...data, query: name, useHistory: false },
        })
      ).json(),
    );
    expect(noConsent.suggestions.some((value) => value.text === name)).toBe(
      false,
    );
    const isolated = AssistanceResultSchema.parse(
      await (
        await other.post('/api/v1/account/assistance', {
          headers,
          data: { ...data, query: name, useHistory: true },
        })
      ).json(),
    );
    expect(isolated.suggestions.some((value) => value.text === name)).toBe(
      false,
    );
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});
