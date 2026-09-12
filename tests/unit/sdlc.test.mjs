import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflow, parseArguments } from '../../scripts/sdlc.mjs';

test('positional commit message never becomes an E2E file filter', () => {
  assert.deepEqual(parseArguments(['sdlc script']), {
    message: 'sdlc script',
    filters: [],
  });
  assert.deepEqual(parseArguments(['--message', 'sdlc script']), {
    message: 'sdlc script',
    filters: [],
  });
  assert.deepEqual(parseArguments(['Fix', '--', '--grep', 'E2E-API-001']), {
    message: 'Fix',
    filters: ['--grep', 'E2E-API-001'],
  });
  assert.throws(() => parseArguments(['--message']));
  assert.throws(() => parseArguments(['Fix', 'unexpected second message']));
});

test('failed checks never stage, commit or run E2E', () => {
  const calls = [];
  assert.throws(
    () =>
      workflow('example', [], (command, args) => {
        calls.push([command, ...args]);
        return args[0] === 'check' ? 1 : 0;
      }),
    /Workflow stopped/,
  );
  assert.deepEqual(calls, [
    ['pnpm', 'format'],
    ['pnpm', 'check'],
  ]);
});

test('clean tree skips commit but executes selected E2E cases', () => {
  const calls = [];
  workflow('example', ['--project=api'], (command, args) => {
    calls.push([command, ...args]);
    return 0;
  });
  assert.ok(!calls.some((args) => args.includes('commit')));
  assert.deepEqual(calls.at(-1), ['pnpm', 'e2e:run', '--project=api']);
});

test('E2E failure occurs after commit and never triggers push or rollback', () => {
  const calls = [];
  assert.throws(
    () =>
      workflow('message with $literal', [], (command, args) => {
        calls.push([command, ...args]);
        return args[0] === 'diff' || args[0] === 'e2e:run' ? 1 : 0;
      }),
    /Workflow stopped/,
  );
  assert.ok(calls.at(-2).includes('commit'));
  assert.equal(calls.at(-2).at(-1), 'message with $literal');
  assert.deepEqual(calls.at(-1), ['pnpm', 'e2e:run']);
  assert.ok(
    !calls.some((args) => args.includes('push') || args.includes('reset')),
  );
});

test('failed commit prevents E2E execution', () => {
  const calls = [];
  assert.throws(() =>
    workflow('example', [], (command, args) => {
      calls.push([command, ...args]);
      return args[0] === 'diff' || args.includes('commit') ? 1 : 0;
    }),
  );
  assert.ok(!calls.some((args) => args.includes('e2e:run')));
});
