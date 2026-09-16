import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyValidation,
  recordCase,
  reportCases,
  storyValidation,
} from '../../scripts/sdlc-validation.mjs';

const evidence = {
  run: 'run-1',
  fingerprint: 'version-1',
  time: '2026-09-16T10:00:00Z',
  log: 'artifacts/sdlc/run-1/check.log',
};
const item = {
  key: 'abc123',
  caseId: 'E2E-API-030',
  project: 'api',
  title: 'Register',
  file: 'api/account.spec.ts',
  stories: ['ACCOUNT-001'],
  status: 'failed',
  details: 'Expected 201, received 503; password=do-not-retain',
};
const matrix = [
  { caseId: 'E2E-API-030', projects: ['api'] },
  { caseId: 'E2E-WEB-030', projects: ['desktop', 'mobile'] },
];

test('story validation keeps skipped and partial selections incomplete and requires current check gate', () => {
  const state = emptyValidation();
  recordCase(state, { ...item, status: 'passed' }, evidence);
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', matrix, 'version-1'),
    'Partial — required cases not run',
  );
  for (const project of ['desktop', 'mobile'])
    recordCase(
      state,
      {
        ...item,
        key: project,
        caseId: 'E2E-WEB-030',
        project,
        status: 'passed',
      },
      evidence,
    );
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', matrix, 'version-1'),
    'Cases passed — current check gate required',
  );
  state.gates.check = 'version-1';
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', matrix, 'version-1'),
    'Passed — automated acceptance',
  );
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', matrix, 'version-2'),
    'Stale — rerun required',
  );
  recordCase(state, { ...item, status: 'skipped' }, evidence);
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', matrix, 'version-1'),
    'Incomplete — skipped or failed cases',
  );
});

test('bugs deduplicate and only an exact passing case resolves them; skipped and unrelated passes cannot', () => {
  const state = emptyValidation();
  recordCase(state, item, evidence);
  recordCase(state, item, { ...evidence, run: 'run-2' });
  assert.equal(Object.keys(state.bugs).length, 1);
  assert.doesNotMatch(state.bugs['BUG-abc123'].details, /do-not-retain/);
  recordCase(state, { ...item, status: 'skipped' }, evidence);
  recordCase(state, { ...item, key: 'another', status: 'passed' }, evidence);
  assert.equal(state.bugs['BUG-abc123'].status, 'Open');
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', matrix, 'version-1'),
    'Failed — unresolved bug',
  );
  recordCase(
    state,
    { ...item, status: 'passed' },
    { ...evidence, run: 'exact-retry' },
  );
  assert.equal(state.bugs['BUG-abc123'].status, 'Resolved');
  assert.equal(state.bugs['BUG-abc123'].resolvedBy.run, 'exact-retry');
  recordCase(state, item, { ...evidence, run: 'regressed' });
  assert.equal(state.bugs['BUG-abc123'].status, 'Open');
});

test('JSON reports inherit suite story tags and retain flaky and unexpected outcomes', () => {
  const make = (status, results, expectedStatus = 'passed') => ({
    status,
    expectedStatus,
    projectName: 'api',
    results: results.map((status) => ({ status, errors: [] })),
  });
  const report = {
    suites: [
      {
        title: 'Accounts @ACCOUNT-001',
        specs: [
          {
            file: 'api/account.spec.ts',
            title: 'E2E-API-030 register',
            tests: [make('expected', ['passed'])],
          },
          {
            file: 'api/account.spec.ts',
            title: 'E2E-API-031 flaky',
            tests: [make('flaky', ['failed', 'passed'])],
          },
          {
            file: 'api/account.spec.ts',
            title: 'E2E-API-032 skip',
            tests: [make('skipped', ['skipped'])],
          },
          {
            file: 'api/account.spec.ts',
            title: 'E2E-API-033 expected failure',
            tests: [make('expected', ['failed'], 'failed')],
          },
        ],
      },
    ],
  };
  const cases = reportCases(report, new Set(['ACCOUNT-001']));
  assert.deepEqual(
    cases.map((entry) => entry.status),
    ['passed', 'flaky', 'skipped', 'failed'],
  );
  assert.deepEqual(cases[0].stories, ['ACCOUNT-001']);
  assert.equal(new Set(cases.map((entry) => entry.key)).size, 4);
});

test('a passing filtered story with no reviewed acceptance matrix never becomes accepted', () => {
  const state = emptyValidation();
  recordCase(state, { ...item, status: 'passed' }, evidence);
  state.gates.check = evidence.fingerprint;
  assert.equal(
    storyValidation(state, 'ACCOUNT-001', undefined, evidence.fingerprint),
    'Selected cases passed — acceptance matrix needed',
  );
  assert.equal(
    storyValidation(state, 'UNSELECTED-001', matrix, evidence.fingerprint),
    'Not run',
  );
});

test('SDLC receipts persist failures and exact repairs to story files, TODO and separate bug tracker', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } =
    await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { createValidationRecorder } =
    await import('../../scripts/sdlc-validation.mjs');
  const root = mkdtempSync(path.join(tmpdir(), 'sdlc-receipts-'));
  const run = path.join(root, 'artifacts/sdlc/run-1');
  try {
    mkdirSync(path.join(root, 'docs/tasks'), { recursive: true });
    mkdirSync(path.join(root, 'artifacts/e2e/result-1'), { recursive: true });
    mkdirSync(run, { recursive: true });
    writeFileSync(
      path.join(root, 'docs/tasks/ACCOUNT-001.md'),
      '# Account\n\n- **Status:** Implementation complete; validation pending\n- **Pending:** Run acceptance.\n\nImplementation scope stays intact.\n',
    );
    writeFileSync(
      path.join(root, 'docs/tasks/acceptance.json'),
      JSON.stringify({
        'ACCOUNT-001': [matrix[0]],
        _completion: {
          'ACCOUNT-001': { implementationComplete: true, externalGates: [] },
        },
      }),
    );
    writeFileSync(
      path.join(root, 'TODO.md'),
      '| Task | Status | Pickup readiness | Blocker / next action |\n| --- | --- | --- | --- |\n| [ACCOUNT-001 — Account](docs/tasks/ACCOUNT-001.md) | Authored | Validation | Run cases |\n',
    );
    const reportFile = path.join(root, 'artifacts/e2e/result-1/results.json');
    const log = path.join(run, 'stage.log');
    const recorder = createValidationRecorder(root, run, () => 'version-1');
    writeFileSync(log, 'All checks passed');
    recorder.observe({
      command: 'pnpm',
      args: ['check'],
      status: 0,
      log,
      fingerprint: 'version-1',
    });
    const writeReport = (passed) => {
      writeFileSync(log, 'Manual run: result-1.');
      writeFileSync(
        reportFile,
        JSON.stringify({
          suites: [
            {
              title: '@ACCOUNT-001',
              specs: [
                {
                  title: 'E2E-API-030 register',
                  file: 'api/account.spec.ts',
                  tests: [
                    {
                      projectName: 'api',
                      expectedStatus: 'passed',
                      status: passed ? 'expected' : 'unexpected',
                      results: [
                        {
                          status: passed ? 'passed' : 'failed',
                          errors: passed
                            ? []
                            : [{ message: 'Expected 201, got 503' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      );
    };
    writeReport(false);
    recorder.observe({
      command: 'pnpm',
      args: ['e2e:run'],
      status: 1,
      log,
      fingerprint: 'version-1',
    });
    recorder.finish();
    assert.match(
      readFileSync(path.join(root, 'docs/bugs/README.md'), 'utf8'),
      /Open/,
    );
    assert.match(
      readFileSync(path.join(root, 'TODO.md'), 'utf8'),
      /Failed — unresolved bug/,
    );
    writeReport(true);
    recorder.observe({
      command: 'pnpm',
      args: ['e2e:run'],
      status: 0,
      log,
      fingerprint: 'version-1',
    });
    recorder.finish();
    assert.match(
      readFileSync(path.join(root, 'docs/bugs/README.md'), 'utf8'),
      /Resolved/,
    );
    const task = readFileSync(
      path.join(root, 'docs/tasks/ACCOUNT-001.md'),
      'utf8',
    );
    assert.match(task, /Implementation scope stays intact/);
    assert.match(task, /Passed — automated acceptance/);
    assert.match(task, /Status:\*\* Done \(accepted scope\)/);
    assert.match(
      readFileSync(path.join(root, 'TODO.md'), 'utf8'),
      /Done \(accepted scope\)/,
    );
    assert.equal(task.match(/sdlc-validation:start/g).length, 1);
    const stale = createValidationRecorder(root, run, () => 'version-2');
    stale.finish();
    assert.match(
      readFileSync(path.join(root, 'TODO.md'), 'utf8'),
      /Stale — rerun required/,
    );
    assert.doesNotMatch(
      readFileSync(path.join(root, 'TODO.md'), 'utf8'),
      /Done \(accepted scope\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('story plans reject unknown coverage and select exact IDs rather than prefix matches', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } =
    await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { storyPlan } = await import('../../scripts/sdlc-validation.mjs');
  const root = mkdtempSync(path.join(tmpdir(), 'sdlc-story-'));
  try {
    mkdirSync(path.join(root, 'docs/tasks'), { recursive: true });
    writeFileSync(
      path.join(root, 'docs/tasks/acceptance.json'),
      JSON.stringify({
        'ACCOUNT-001': [
          ...matrix,
          { caseId: 'E2E-OFFLINE-034', projects: ['offline'] },
        ],
      }),
    );
    const plan = storyPlan(root, 'ACCOUNT-001');
    assert.ok(new RegExp(plan.connected).test('E2E-API-030 register'));
    assert.ok(!new RegExp(plan.connected).test('E2E-API-0300 different case'));
    assert.ok(
      !new RegExp(plan.connected).test('E2E-OFFLINE-034 local account'),
    );
    assert.ok(new RegExp(plan.offline).test('E2E-OFFLINE-034 local account'));
    assert.throws(
      () => storyPlan(root, 'UNKNOWN-001'),
      /No reviewed acceptance matrix/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing and malformed reports retain workflow bugs and never borrow a prior passing report', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } =
    await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { createValidationRecorder } =
    await import('../../scripts/sdlc-validation.mjs');
  const root = mkdtempSync(path.join(tmpdir(), 'sdlc-missing-report-'));
  const run = path.join(root, 'artifacts/sdlc/run-2');
  try {
    mkdirSync(path.join(root, 'docs/tasks'), { recursive: true });
    mkdirSync(path.join(root, 'artifacts/e2e/broken'), { recursive: true });
    mkdirSync(run, { recursive: true });
    writeFileSync(path.join(root, 'TODO.md'), '# Tasks\n');
    writeFileSync(
      path.join(root, 'artifacts/e2e/broken/results.json'),
      'invalid json',
    );
    const log = path.join(run, 'stage.log');
    writeFileSync(log, 'Manual run: broken.');
    const recorder = createValidationRecorder(root, run, () => 'version-1');
    recorder.observe({
      command: 'pnpm',
      args: ['e2e:run'],
      status: 1,
      log,
      fingerprint: 'version-1',
    });
    recorder.finish();
    let state = JSON.parse(
      readFileSync(path.join(root, 'docs/validation/results.json'), 'utf8'),
    );
    assert.equal(Object.keys(state.cases).length, 0);
    assert.equal(Object.values(state.bugs)[0].status, 'Open');
    writeFileSync(log, 'No test reporter started');
    recorder.observe({
      command: 'pnpm',
      args: ['e2e:run'],
      status: 0,
      log,
      fingerprint: 'version-1',
    });
    recorder.finish();
    state = JSON.parse(
      readFileSync(path.join(root, 'docs/validation/results.json'), 'utf8'),
    );
    assert.equal(Object.values(state.bugs)[0].status, 'Open');
    assert.equal(Object.keys(state.bugs).length, 1);
    assert.match(
      Object.values(state.bugs)[0].details,
      /No complete run-specific/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
