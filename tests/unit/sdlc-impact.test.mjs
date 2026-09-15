import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  impactBaseline,
  impactChanges,
  selectImpact,
  caseFilters,
} from '../../scripts/sdlc-impact.mjs';
import { parseArguments, workflow } from '../../scripts/sdlc.mjs';

const api = 'tests/e2e/cases/api/feedback.spec.ts';
const browser = 'tests/e2e/cases/browser/feedback.spec.ts';
const other = 'tests/e2e/cases/browser/goals.spec.ts';
const offline = 'tests/e2e/cases/offline/feedback.spec.ts';
const inventory = [api, browser, other, offline];

test('affected arguments support preview/base and reject conflicting selection', () => {
  assert.deepEqual(parseArguments(['Fix', '--affected', '--base', 'HEAD~1']), {
    message: 'Fix',
    filters: [],
    affected: true,
    base: 'HEAD~1',
  });
  assert.equal(parseArguments(['--affected-plan']).preview, true);
  for (const args of [
    ['--affected', '--checks-only'],
    ['--base', 'HEAD~1'],
    ['--affected', '--base'],
    ['--affected', '--', '--project=api'],
  ])
    assert.throws(() => parseArguments(args));
});

test('baseline is resolved once and changes include deleted/staged/unstaged/untracked paths', () => {
  const calls = [];
  const read = (root, args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return 'abc123\n';
    if (args[0] === 'diff') return 'old.ts\0new.ts\0';
    return 'untracked.ts\0new.ts\0';
  };
  const base = impactBaseline('/repo', 'HEAD~1', read);
  assert.equal(base, 'abc123');
  assert.deepEqual(impactChanges('/repo', base, read), [
    'new.ts',
    'old.ts',
    'untracked.ts',
  ]);
  assert.ok(calls[1].includes('--no-renames'));
  assert.ok(calls[1].includes('abc123'));
  assert.throws(() =>
    impactBaseline('/repo', 'missing', () => {
      throw Error('bad ref');
    }),
  );
});

test('changed case selects its exact file; deleted case falls back to all', () => {
  const plan = selectImpact([browser], inventory);
  assert.deepEqual(plan.connected, [browser]);
  assert.deepEqual(plan.offline, []);
  assert.equal(
    selectImpact(['tests/e2e/cases/browser/deleted.spec.ts'], inventory)
      .connected.length,
    3,
  );
  assert.equal(
    selectImpact([browser], inventory, () => false).offline.length,
    1,
  );
});

test('web changes retain mobile and offline coverage; shared/unknown changes broaden', () => {
  assert.deepEqual(
    selectImpact(['apps/web/src/App.tsx'], inventory).connected,
    [browser, other],
  );
  assert.deepEqual(selectImpact(['apps/web/src/App.tsx'], inventory).offline, [
    offline,
  ]);
  assert.deepEqual(
    selectImpact(['apps/web/src/offline/feedback.ts'], inventory).connected,
    [],
  );
  for (const file of [
    'packages/contracts/src/feedback.ts',
    'apps/api/src/feedback.ts',
    'infra/migrations/001.sql',
    'pnpm-lock.yaml',
    'tests/e2e/helpers/feedback.ts',
    'new-config.json',
  ]) {
    assert.equal(selectImpact([file], inventory).connected.length, 3);
    assert.equal(selectImpact([file], inventory).offline.length, 1);
  }
});

test('docs and unit-only changes skip E2E; empty baseline never implies prior success', () => {
  const plan = selectImpact(
    [
      'README.md',
      'TODO.md',
      'docs/development/sdlc.md',
      'tests/unit/sdlc.test.mjs',
    ],
    inventory,
  );
  assert.deepEqual(plan.connected, []);
  assert.deepEqual(plan.offline, []);
  assert.equal(selectImpact([], inventory).connected.length, 3);
});

test('file filters escape regex metacharacters and cannot match another suffix', () => {
  const pattern = caseFilters([browser])[0];
  assert.ok(new RegExp(pattern).test(`/repo/${browser}`));
  assert.equal(new RegExp(pattern).test(`/repo/${browser}.backup`), false);
  assert.equal(
    new RegExp(pattern).test(`/repo/${browser.replace('.spec', 'Xspec')}`),
    false,
  );
});

test('workflow selects after gated commit, then runs selected connected and freshly built offline tests', async () => {
  const calls = [];
  await workflow(
    'affected',
    [],
    async (command, args) => {
      calls.push([command, ...args]);
      return command === 'git' && args[0] === 'diff' ? 1 : 0;
    },
    {
      impactPlan: () => {
        assert.ok(calls.some((call) => call.includes('commit')));
        return { connected: [browser], offline: [offline] };
      },
    },
  );
  assert.deepEqual(calls.slice(0, 2), [
    ['pnpm', 'format'],
    ['pnpm', 'check'],
  ]);
  assert.deepEqual(calls.slice(-3), [
    ['pnpm', 'e2e:run', ...caseFilters([browser])],
    ['pnpm', 'android:web'],
    ['pnpm', 'android:test', ...caseFilters([offline])],
  ]);
});

test('check failure prevents selection/commit and offline failure cannot dispatch a broad repair', async () => {
  await assert.rejects(
    workflow('bad', [], async () => 1, {
      impactPlan: () => {
        throw Error('should not select');
      },
    }),
    /format failed/,
  );
  let repaired = false;
  await assert.rejects(
    workflow(
      'bad offline',
      [],
      async (command, args) => (args[0] === 'android:test' ? 1 : 0),
      {
        impactPlan: () => ({ connected: [], offline: [offline] }),
        recover: async () => {
          repaired = true;
          return true;
        },
      },
    ),
    /android:test failed/,
  );
  assert.equal(repaired, false);
});
