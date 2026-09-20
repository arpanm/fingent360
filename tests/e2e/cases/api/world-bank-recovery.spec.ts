import { createHash } from 'node:crypto';
import { test, expect } from '../../helpers/feedback-fixture';
import {
  seedStaleMacro,
  worldBankMode,
  macroIndicator,
} from '../../helpers/world-bank-recovery';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  MacroDashboardSchema,
  MacroHistorySchema,
  MacroEvidenceSchema,
  MacroRunSchema,
} from '../../../../packages/contracts/src/index';
test.use({
  worldBankSimulation: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-API-2310 real macro pipeline preserves accepted evidence through upstream failures and recovers stale cache @DATA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { headers, source } = await seedStaleMacro(request, feedbackSandbox);
  const observation = source.observations[0]!;
  const acceptedEvidence = MacroEvidenceSchema.parse(
    await (
      await request.get(`/api/v1/macro/evidence/${observation.sourceHash}`)
    ).json(),
  );
  expect(
    createHash('sha256')
      .update(acceptedEvidence.url + '\n' + acceptedEvidence.body)
      .digest('hex'),
  ).toBe(observation.sourceHash);
  const cases = [
    ['http', 'HTTP 503'],
    ['network', 'could not be reached'],
    ['format', 'unexpected response format'],
    ['empty', 'empty response'],
    ['interrupted', 'download was interrupted'],
    ['oversized', '1 MB limit'],
    ['invalid', 'Provider schema changed'],
  ] as const;
  for (const [mode, message] of cases) {
    await worldBankMode(feedbackSandbox, mode);
    const response = await request.post('/api/v1/macro/refresh', {
      headers,
      data: { indicator: macroIndicator },
    });
    expect(response.status()).toBe(503);
    expect((await response.json()).message).toContain(message);
    const dashboard = MacroDashboardSchema.parse(
      await (await request.get('/api/v1/macro')).json(),
    );
    const retained = dashboard.sources.find(
      (row) => row.indicator === macroIndicator,
    )!;
    expect(retained).toEqual(source);
    const history = MacroHistorySchema.parse(
      await (
        await request.get(`/api/v1/macro/${macroIndicator}/history/2024`)
      ).json(),
    );
    expect(history).toEqual([observation]);
    expect(
      MacroEvidenceSchema.parse(
        await (
          await request.get(`/api/v1/macro/evidence/${observation.sourceHash}`)
        ).json(),
      ),
    ).toEqual(acceptedEvidence);
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      const failed = (
        await pool.query(
          'SELECT status,message,inserted FROM macro_runs WHERE indicator=$1 ORDER BY started_at DESC LIMIT 1',
          [macroIndicator],
        )
      ).rows[0];
      expect(failed.status).toBe('failed');
      expect(failed.inserted).toBe(0);
      expect(failed.message).toContain(message);
      if (mode === 'invalid') {
        const attempt = (
          await pool.query(
            'SELECT last_url,last_body FROM test_world_bank_provider WHERE id=true',
          )
        ).rows[0];
        const rejectedHash = createHash('sha256')
          .update(attempt.last_url + '\n' + attempt.last_body)
          .digest('hex');
        expect(
          (
            await request.get(`/api/v1/macro/evidence/${rejectedHash}`)
          ).status(),
        ).toBe(404);
      }
    } finally {
      await pool.end();
    }
  }
  await worldBankMode(feedbackSandbox, 'success');
  const recovered = await request.post('/api/v1/macro/refresh', {
    headers,
    data: { indicator: macroIndicator },
  });
  expect(recovered.status()).toBe(200);
  expect(MacroRunSchema.parse(await recovered.json()).inserted).toBe(0);
  const dashboard = MacroDashboardSchema.parse(
    await (await request.get('/api/v1/macro')).json(),
  );
  expect(
    dashboard.sources.find((row) => row.indicator === macroIndicator)
      ?.freshness,
  ).toBe('recently_checked');
  expect(
    dashboard.sources.find((row) => row.indicator === macroIndicator)
      ?.observations,
  ).toEqual(source.observations);
});
