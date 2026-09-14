import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { MaterialExportSchema } from '../../../../packages/contracts/src/index';
import {
  connectionDatabase,
  connectionHeaders,
  connectionPassword,
  prepareConnectionAccount,
} from '../../helpers/research-connection-fixture';
import {
  configureMaterial,
  followMaterial,
  materialPath,
  materialView,
  materialWrite,
  seedMaterialObservation,
} from '../../helpers/material-alert-fixture';
import { startWorker } from '../../helpers/worker-health';
test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-API-790 automatic opt-in starts future baseline; concurrent workers and restart produce one immutable receipt @MATERIAL-AUTO-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  expect((await materialView(request)).state.automatic.enabled).toBe(false);
  const enabled = await materialWrite(request, {
    action: 'automatic-settings',
    enabled: true,
    backgroundConsent: true,
  });
  expect(
    Date.parse(enabled.receipt.state.automatic.nextCheckAt!) -
      Date.parse(enabled.receipt.at),
  ).toBe(86400000);
  const workers = await Promise.all([
    startWorker(feedbackSandbox),
    startWorker(feedbackSandbox),
  ]);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(await workers[0]!.run('material')).toBe(false);
    await seedMaterialObservation(feedbackSandbox, 2021, '3');
    await pool.query(`UPDATE material_alert_heads SET automatic_due_at=clock_timestamp()-interval '1 second',
      payload=jsonb_set(payload,'{automatic,nextCheckAt}',to_jsonb(to_char(clock_timestamp()-interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))`);
    const results = await Promise.all(
      workers.map((worker) => worker.run('material')),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const current = await materialView(request);
    expect(current.state.notices[0]?.differencePoints).toBe('2');
    const history = MaterialExportSchema.parse(
      await (await request.get(materialPath + '/history')).json(),
    );
    expect(
      history.events.filter(
        (event) => event.receipt.action === 'automatic-check',
      ),
    ).toHaveLength(1);
    const restarted = await startWorker(feedbackSandbox);
    try {
      expect(await restarted.run('material')).toBe(false);
    } finally {
      await restarted.close();
    }
    await materialWrite(request, {
      action: 'configure',
      policies: [],
      storageConsent: true,
    });
    expect(
      (await materialView(request)).state.automatic.nextCheckAt,
    ).toBeNull();
    expect(
      (await pool.query('SELECT automatic_due_at FROM material_alert_heads'))
        .rows[0].automatic_due_at,
    ).toBeNull();
    const replay = await request.post(materialPath, {
      headers: connectionHeaders,
      data: enabled.input,
    });
    expect(await replay.json()).toEqual(enabled.receipt);
    expect((await materialView(request)).state.automatic.enabled).toBe(false);
    const exported = await (
      await request.get('/api/v1/account/privacy/export')
    ).json();
    expect(
      exported.materialAlerts.events.some(
        (event: { receipt: { action: string } }) =>
          event.receipt.action === 'automatic-check',
      ),
    ).toBe(true);
    expect(
      (
        await request.delete('/api/v1/account', {
          headers: connectionHeaders,
          data: { password: connectionPassword },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM material_alert_heads'))
        .rows[0].n,
    ).toBe(0);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM material_alert_events'))
        .rows[0].n,
    ).toBe(0);
  } finally {
    await Promise.all(workers.map((worker) => worker.close()));
    await pool.end();
  }
});

test('E2E-API-791 revoked purpose stops due checks and manual evaluation remains available @MATERIAL-AUTO-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  await materialWrite(request, {
    action: 'automatic-settings',
    enabled: true,
    backgroundConsent: true,
  });
  const consent = await (await request.get('/api/v1/account/consents')).json();
  const purpose = consent.purposes.find(
    (entry: { record: { purpose: string } }) =>
      entry.record.purpose === 'automatic-material-checks',
  ).record;
  expect(
    (
      await request.post('/api/v1/account/consents/automatic-material-checks', {
        headers: connectionHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: purpose.version,
          action: 'revoke',
          policyVersion: 'purpose-consent-v1',
          reviewed: true,
        },
      })
    ).status(),
  ).toBe(201);
  const pool = await connectionDatabase(feedbackSandbox),
    worker = await startWorker(feedbackSandbox);
  try {
    await pool.query(`UPDATE material_alert_heads SET automatic_due_at=clock_timestamp()-interval '1 second',
      payload=jsonb_set(payload,'{automatic,nextCheckAt}',to_jsonb(to_char(clock_timestamp()-interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))`);
    await worker.run('material');
    const view = await materialView(request);
    expect(view.state.automatic.enabled).toBe(false);
    expect(view.state.automatic.lastResult).toBe('consent-unavailable');
    expect(view.state.notices).toEqual([]);
    expect(
      (await materialWrite(request, { action: 'check' })).receipt.action,
    ).toBe('check');
  } finally {
    await worker.close();
    await pool.end();
  }
});

test('E2E-API-792 one failing account rolls back and defers without starving a second due account @MATERIAL-AUTO-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const pool = await connectionDatabase(feedbackSandbox),
    worker = await startWorker(feedbackSandbox);
  try {
    await seedMaterialObservation(feedbackSandbox, 2020, '1');
    for (const context of [request, other]) {
      await prepareConnectionAccount(context);
      await followMaterial(context);
      await configureMaterial(context);
      await materialWrite(context, {
        action: 'automatic-settings',
        enabled: true,
        backgroundConsent: true,
      });
    }
    const ids = (
      await pool.query(
        'SELECT user_id FROM material_alert_heads ORDER BY user_id',
      )
    ).rows.map((row: { user_id: string }) => row.user_id);
    await pool.query(`UPDATE material_alert_heads SET automatic_due_at=clock_timestamp()-interval '1 second',
      payload=jsonb_set(payload,'{automatic,nextCheckAt}',to_jsonb(to_char(clock_timestamp()-interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))`);
    await pool.query(`CREATE FUNCTION fail_owned_material() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.user_id='${ids[0]}'::uuid AND NEW.payload->>'action'='automatic-check' THEN RAISE EXCEPTION 'Synthetic failure'; END IF; RETURN NEW; END $$`);
    await pool.query(
      'CREATE TRIGGER fail_owned_material BEFORE INSERT ON material_alert_events FOR EACH ROW EXECUTE FUNCTION fail_owned_material()',
    );
    await worker.run('material');
    await worker.run('material');
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM material_alert_events WHERE payload->>'action'='automatic-check'",
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await pool.query(
          'SELECT automatic_retry_at IS NOT NULL AS retry FROM material_alert_heads WHERE user_id=$1',
          [ids[0]],
        )
      ).rows[0].retry,
    ).toBe(true);
    await pool.query(
      'DROP TRIGGER fail_owned_material ON material_alert_events',
    );
    await pool.query(
      'UPDATE material_alert_heads SET automatic_retry_at=NULL WHERE user_id=$1',
      [ids[0]],
    );
    await worker.run('material');
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM material_alert_events WHERE payload->>'action'='automatic-check'",
        )
      ).rows[0].n,
    ).toBe(2);
  } finally {
    await worker.close();
    await pool.end();
    await other.dispose();
  }
});
