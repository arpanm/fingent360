import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  loginWorkerOperator,
  workerDatabase,
  workerHeaders,
} from '../../helpers/worker-health';
import { DeploymentMonitoringSchema } from '../../../../packages/contracts/src/index';
test.use({ manualWorkers: true });
const base = '/api/v1/ops/monitoring';
test('E2E-API-1270 persisted multi-process samples aggregate and incident acknowledgment survives recovery and recurrence @DEV-021 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  expect((await request.get(base)).status()).toBe(401);
  await loginWorkerOperator(request);
  const db = await workerDatabase(feedbackSandbox);
  const a = randomUUID(),
    b = randomUUID();
  try {
    const empty = DeploymentMonitoringSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(empty.samples).toBe(0);
    expect(empty.lastHeartbeat).toBeNull();
    await db.query(
      'INSERT INTO deployment_monitor_processes(id) VALUES($1),($2)',
      [a, b],
    );
    await db.query(
      'INSERT INTO deployment_monitor_samples(id,process_id,completed,server_errors,slow,disconnected) VALUES($1,$2,10,2,1,1),($3,$4,10,0,2,0)',
      [randomUUID(), a, randomUUID(), b],
    );
    const first = DeploymentMonitoringSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(first.processes).toBe(2);
    expect(first.completed).toBe(20);
    expect(first.serverErrors).toBe(2);
    expect(first.slow).toBe(3);
    const incident = first.incidents.find(
      (item) => item.kind === 'server-errors',
    );
    expect(incident).toBeTruthy();
    const id = incident!.id;
    expect(
      (
        await request.post(`${base}/acknowledge`, {
          headers: { Origin: 'https://foreign.invalid' },
          data: { id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post(`${base}/acknowledge`, {
          headers: workerHeaders,
          data: { id, unknown: true },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post(`${base}/acknowledge`, {
          headers: workerHeaders,
          data: { id },
        })
      ).status(),
    ).toBe(201);
    const acknowledged = DeploymentMonitoringSchema.parse(
      await (await request.get(base)).json(),
    ).incidents.find((item) => item.id === id)!;
    expect(acknowledged.acknowledgedAt).not.toBeNull();
    expect(acknowledged.resolvedAt).toBeNull();
    await request.post(`${base}/acknowledge`, {
      headers: workerHeaders,
      data: { id },
    });
    expect(
      DeploymentMonitoringSchema.parse(
        await (await request.get(base)).json(),
      ).incidents.find((item) => item.id === id)!.acknowledgedAt,
    ).toBe(acknowledged.acknowledgedAt);
    await db.query(
      "UPDATE deployment_monitor_samples SET observed_at=clock_timestamp()-interval '16 minutes'",
    );
    expect(
      DeploymentMonitoringSchema.parse(
        await (await request.get(base)).json(),
      ).incidents.find((item) => item.id === id)!.resolvedAt,
    ).not.toBeNull();
    await db.query(
      'INSERT INTO deployment_monitor_samples(id,process_id,completed,server_errors,slow,disconnected) VALUES($1,$2,20,1,0,0)',
      [randomUUID(), b],
    );
    const recurrent = DeploymentMonitoringSchema.parse(
      await (await request.get(base)).json(),
    ).incidents.find((item) => item.resolvedAt === null)!;
    expect(recurrent.id).not.toBe(id);
    expect(recurrent.acknowledgedAt).toBeNull();
  } finally {
    await db.end();
  }
});
test('E2E-API-1271 missing heartbeat opens durable alert and confirmed decommission excludes retired process @DEV-021 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await loginWorkerOperator(request);
  const db = await workerDatabase(feedbackSandbox);
  try {
    await db.query(
      "INSERT INTO deployment_monitor_processes(id,heartbeat_at) VALUES($1,clock_timestamp()-interval '4 minutes')",
      [randomUUID()],
    );
    const before = DeploymentMonitoringSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(before.staleProcesses).toBe(1);
    expect(before.incidents[0]?.kind).toBe('missing-heartbeat');
    expect(
      (
        await request.post(`${base}/retire-missing`, {
          headers: workerHeaders,
          data: { confirm: false },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post(`${base}/retire-missing`, {
          headers: workerHeaders,
          data: { confirm: true },
        })
      ).status(),
    ).toBe(201);
    const after = DeploymentMonitoringSchema.parse(
      await (await request.get(base)).json(),
    );
    expect(after.staleProcesses).toBe(0);
    expect(after.processes).toBe(0);
    expect(after.incidents[0]?.resolvedAt).not.toBeNull();
  } finally {
    await db.end();
  }
});

test.describe('Named monitoring permissions', () => {
  test.use({ namedOperators: true, manualWorkers: true });
  test('E2E-API-1272 named viewer can read incidents but cannot acknowledge or retire processes @DEV-021 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    expect(feedbackSandbox.namedCredentials).toBeDefined();
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers: workerHeaders,
          data: feedbackSandbox.namedCredentials,
        })
      ).status(),
    ).toBe(200);
    const username = 'viewer_' + randomUUID().slice(0, 8),
      password = 'Synthetic-monitor-viewer-2026';
    expect(
      (
        await request.post('/api/v1/ops/operators', {
          headers: workerHeaders,
          data: { username, password, role: 'viewer' },
        })
      ).status(),
    ).toBe(201);
    const db = await workerDatabase(feedbackSandbox);
    try {
      await db.query(
        "INSERT INTO deployment_monitor_processes(id,heartbeat_at) VALUES($1,clock_timestamp()-interval '4 minutes')",
        [randomUUID()],
      );
    } finally {
      await db.end();
    }
    const viewer = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      expect(
        (
          await viewer.post('/api/v1/ops/session', {
            headers: workerHeaders,
            data: { username, password },
          })
        ).status(),
      ).toBe(200);
      const response = await viewer.get(base);
      expect(response.status()).toBe(200);
      const before = DeploymentMonitoringSchema.parse(await response.json()),
        id = before.incidents[0]!.id;
      expect(
        (
          await viewer.post(`${base}/acknowledge`, {
            headers: workerHeaders,
            data: { id },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await viewer.post(`${base}/retire-missing`, {
            headers: workerHeaders,
            data: { confirm: true },
          })
        ).status(),
      ).toBe(403);
      const after = DeploymentMonitoringSchema.parse(
        await (await viewer.get(base)).json(),
      );
      expect(after.staleProcesses).toBe(1);
      expect(after.incidents[0]!.acknowledgedAt).toBeNull();
    } finally {
      await viewer.dispose();
    }
  });
});
