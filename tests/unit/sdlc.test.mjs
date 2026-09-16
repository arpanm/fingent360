import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  workflow,
  parseArguments,
  repairFailure,
  SdlcStageFailure,
  repairPrompt,
  failedCases,
  formattingFiles,
  resolveCodexBinary,
} from '../../scripts/sdlc.mjs';

test('repair CLI finds installed app when shell PATH lacks Codex', () => {
  const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex';
  const available = (file) => file === bundled || file === '/tools/codex';
  assert.equal(
    resolveCodexBinary(
      { PATH: '/usr/bin' },
      'darwin',
      '/users/test',
      available,
    ),
    bundled,
  );
  assert.equal(
    resolveCodexBinary({ PATH: '/tools' }, 'darwin', '/users/test', available),
    '/tools/codex',
  );
  assert.equal(
    resolveCodexBinary(
      { PATH: '/tools', SDLC_CODEX_BIN: bundled },
      'darwin',
      '/users/test',
      available,
    ),
    bundled,
  );
  assert.throws(
    () =>
      resolveCodexBinary(
        { SDLC_CODEX_BIN: '/missing' },
        'darwin',
        '/users/test',
        available,
      ),
    /not found/,
  );
  assert.throws(
    () =>
      resolveCodexBinary(
        { PATH: '/usr/bin' },
        'linux',
        '/users/test',
        available,
      ),
    /not found/,
  );
});

test('format warning paths reject traversal, globs, flags and escaping symlinks', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sdlc-paths-'));
  const outside = mkdtempSync(path.join(tmpdir(), 'sdlc-outside-'));
  const warning = (file) =>
    `[warn] ${file}\n[warn] Code style issues found in 1 file.`;
  try {
    writeFileSync(path.join(directory, 'safe.ts'), 'const x=1');
    writeFileSync(path.join(outside, 'external.ts'), 'const x=1');
    symlinkSync(outside, path.join(directory, 'outside'));
    assert.deepEqual(formattingFiles(warning('safe.ts'), directory), [
      'safe.ts',
    ]);
    for (const file of [
      '../bad.ts',
      '*.ts',
      '--config.js',
      '/tmp/bad.ts',
      'outside/external.ts',
    ]) {
      assert.deepEqual(formattingFiles(warning(file), directory), []);
    }
    assert.deepEqual(
      formattingFiles(warning('safe.ts') + '\n[error] parse failed', directory),
      [],
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('format-only failure uses the formatter then stopped check without an agent or repair budget', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sdlc-format-'));
  const log = path.join(directory, 'check.log');
  try {
    writeFileSync(
      log,
      '[warn] scripts/sdlc.mjs\n[warn] Code style issues found in 1 file.',
    );
    const calls = [],
      budget = { used: 0 };
    assert.equal(
      await repairFailure(
        new SdlcStageFailure('pnpm', ['check'], 1, log),
        () => {
          throw Error('Unexpected agent');
        },
        {},
        async (command, args) => {
          calls.push([command, ...args]);
          return 0;
        },
        undefined,
        budget,
      ),
      true,
    );
    assert.deepEqual(calls, [
      ['pnpm', 'exec', 'prettier', '--write', '--', 'scripts/sdlc.mjs'],
      ['pnpm', 'check'],
    ]);
    assert.equal(budget.used, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('formatting exposed by the last agent attempt uses Prettier without another agent', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sdlc-after-repair-'));
  const log = path.join(directory, 'check.log');
  const calls = [];
  const prompts = [];
  const budget = { used: 0 };
  try {
    writeFileSync(log, 'TS2322: initial compiler failure');
    const repaired = await repairFailure(
      new SdlcStageFailure('pnpm', ['check'], 2, log),
      async (prompt) => prompts.push(prompt),
      { SDLC_REPAIR_LIMIT: '1' },
      async (command, args) => {
        calls.push([command, ...args]);
        if (calls.length === 1) {
          writeFileSync(
            log,
            '[warn] scripts/sdlc.mjs\n[warn] Code style issues found in 1 file.',
          );
          return 1;
        }
        return 0;
      },
      undefined,
      budget,
    );
    assert.equal(repaired, true);
    assert.equal(prompts.length, 1);
    assert.equal(budget.used, 1);
    assert.deepEqual(calls, [
      ['pnpm', 'check'],
      ['pnpm', 'exec', 'prettier', '--write', '--', 'scripts/sdlc.mjs'],
      ['pnpm', 'check'],
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('after formatting recovery the next agent receives only the new compiler failure', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sdlc-next-error-'));
  const log = path.join(directory, 'check.log');
  const prompts = [];
  const budget = { used: 0 };
  let checks = 0;
  try {
    writeFileSync(log, 'TS2322: original compiler failure');
    assert.equal(
      await repairFailure(
        new SdlcStageFailure('pnpm', ['check'], 2, log),
        async (prompt) => prompts.push(prompt),
        { SDLC_REPAIR_LIMIT: '2' },
        async (_command, args) => {
          if (args[0] !== 'check') return 0;
          checks++;
          if (checks === 1) {
            writeFileSync(
              log,
              '[warn] scripts/sdlc.mjs\n[warn] Code style issues found in 1 file.',
            );
            return 1;
          }
          if (checks === 2) {
            writeFileSync(log, 'TS2307: replacement compiler failure');
            return 2;
          }
          return 0;
        },
        undefined,
        budget,
      ),
      true,
    );
    assert.equal(checks, 3);
    assert.equal(budget.used, 2);
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /TS2307: replacement compiler failure/);
    assert.doesNotMatch(prompts[1], /TS2322|Code style issues found/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('repeated formatting drift stops after two retries without launching an agent', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sdlc-drift-'));
  const log = path.join(directory, 'check.log');
  try {
    writeFileSync(
      log,
      '[warn] scripts/sdlc.mjs\n[warn] Code style issues found in 1 file.',
    );
    const calls = [];
    await assert.rejects(
      repairFailure(
        new SdlcStageFailure('pnpm', ['check'], 1, log),
        () => {
          throw Error('Unexpected agent');
        },
        {},
        async (command, args) => {
          calls.push([command, ...args]);
          return args[0] === 'check' ? 1 : 0;
        },
      ),
      /two scoped retries/,
    );
    assert.equal(calls.length, 4);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('positional commit message never becomes an E2E file filter', async () => {
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

test('failed checks never stage, commit or run E2E', async () => {
  const calls = [];
  await assert.rejects(
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

test('clean tree skips commit but executes selected E2E cases', async () => {
  const calls = [];
  await workflow('example', ['--project=api'], (command, args) => {
    calls.push([command, ...args]);
    return 0;
  });
  assert.ok(!calls.some((args) => args.includes('commit')));
  assert.deepEqual(calls.at(-1), ['pnpm', 'e2e:run', '--project=api']);
});

test('E2E failure occurs after commit and never triggers push or rollback', async () => {
  const calls = [];
  await assert.rejects(
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

test('failed commit prevents E2E execution', async () => {
  const calls = [];
  await assert.rejects(() =>
    workflow('example', [], (command, args) => {
      calls.push([command, ...args]);
      return args[0] === 'diff' || args.includes('commit') ? 1 : 0;
    }),
  );
  assert.ok(!calls.some((args) => args.includes('e2e:run')));
});

test('checks-only explicitly skips E2E but preserves both pre-commit gates', async () => {
  assert.deepEqual(parseArguments(['Fix', '--checks-only']), {
    message: 'Fix',
    filters: [],
    checksOnly: true,
  });
  assert.deepEqual(parseArguments(['--checks-only', '--message', 'Fix']), {
    message: 'Fix',
    filters: [],
    checksOnly: true,
  });
  assert.throws(() =>
    parseArguments(['Fix', '--checks-only', '--', '--grep', 'E2E-API-001']),
  );
  const calls = [];
  await workflow(
    'Fix',
    [],
    (command, args) => {
      calls.push([command, ...args]);
      return args[0] === 'diff' ? 1 : 0;
    },
    { checksOnly: true },
  );
  assert.deepEqual(calls.slice(0, 2), [
    ['pnpm', 'format'],
    ['pnpm', 'check'],
  ]);
  assert.ok(calls.at(-1).includes('commit'));
  assert.ok(
    !calls.some((call) => call.includes('e2e:run') || call.includes('push')),
  );
});

test('checks-only still refuses commit after a failed check', async () => {
  const calls = [];
  await assert.rejects(() =>
    workflow(
      'Fix',
      [],
      (command, args) => {
        calls.push([command, ...args]);
        return args[0] === 'check' ? 1 : 0;
      },
      { checksOnly: true },
    ),
  );
  assert.deepEqual(calls, [
    ['pnpm', 'format'],
    ['pnpm', 'check'],
  ]);
});

test('failed command launches one author-only repair and retries that command', async () => {
  const failure = new SdlcStageFailure('pnpm', ['lint'], 2);
  const prompts = [];
  assert.equal(
    await repairFailure(
      failure,
      async (prompt) => {
        prompts.push(prompt);
      },
      {},
      async () => 0,
    ),
    true,
  );
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /authoring and read-only inspection only/);
  assert.match(prompts[0], /Do not commit, push, spawn/);
  assert.match(prompts[0], /pnpm lint failed/);
  assert.match(
    repairPrompt(
      new SdlcStageFailure('pnpm', ['e2e:run', '--grep', 'TASK-001'], 1),
    ),
    /Do not read the whole suite report/,
  );
});

test('repair is never recursive and opt-out cancellation or argument errors do not launch it', async () => {
  let calls = 0;
  const launch = async () => {
    calls++;
  };
  const failure = new SdlcStageFailure('pnpm', ['check'], 1);
  assert.equal(
    await repairFailure(failure, launch, { SDLC_AUTO_REPAIR: '0' }),
    false,
  );
  assert.equal(
    await repairFailure(failure, launch, { F360_SDLC_REPAIR_ACTIVE: '1' }),
    false,
  );
  assert.equal(
    await repairFailure(
      new SdlcStageFailure('pnpm', ['check'], 130),
      launch,
      {},
    ),
    false,
  );
  assert.equal(await repairFailure(Error('bad arguments'), launch, {}), false);
  assert.equal(calls, 0);
  await assert.rejects(
    () =>
      repairFailure(
        failure,
        async () => {
          throw Error('CLI unavailable');
        },
        {},
      ),
    /CLI unavailable/,
  );
});

const sampleReport = () => ({
  suites: [
    {
      specs: [
        {
          file: 'browser/goals.spec.ts',
          line: 10,
          title: 'E2E-WEB-001 failed [case]',
          tests: [
            {
              projectName: 'mobile',
              status: 'unexpected',
              expectedStatus: 'passed',
              results: [
                {
                  status: 'failed',
                  errors: [{ message: 'Only this assertion' }],
                },
              ],
            },
          ],
        },
        {
          file: 'api/account.spec.ts',
          line: 20,
          title: 'E2E-API-002 passes',
          tests: [
            {
              projectName: 'api',
              status: 'expected',
              results: [{ status: 'passed' }],
            },
          ],
        },
      ],
    },
  ],
});

test('one exact failed case and project are retried without passed cases or whole-suite commands', async () => {
  const report = sampleReport();
  const scopes = failedCases(report);
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].details, 'Only this assertion');
  assert.ok(scopes[0].args.includes('--project=mobile'));
  assert.equal(scopes[0].args.at(-1), String.raw`E2E-WEB-001 failed \[case\]$`);
  const calls = [],
    prompts = [];
  assert.equal(
    await repairFailure(
      new SdlcStageFailure('pnpm', ['e2e:run'], 1),
      async (prompt) => {
        prompts.push(prompt);
      },
      {},
      async (command, args) => {
        calls.push([command, ...args]);
        return 0;
      },
      () => report,
    ),
    true,
  );
  assert.deepEqual(calls[0], ['pnpm', 'build']);
  assert.deepEqual(calls[1], ['pnpm', ...scopes[0].args]);
  assert.ok(!prompts[0].includes('E2E-API-002'));
  assert.equal(prompts.length, 1);
});

test('unresolved repair stops at the explicit budget and cannot broaden test scope', async () => {
  let launches = 0;
  const report = sampleReport();
  await assert.rejects(
    () =>
      repairFailure(
        new SdlcStageFailure('pnpm', ['e2e:run'], 1),
        async () => {
          launches++;
        },
        { SDLC_REPAIR_LIMIT: '1' },
        async (_command, args) => (args[0] === 'build' ? 0 : 1),
        () => report,
      ),
    /Repair limit/,
  );
  assert.equal(launches, 1);
  await assert.rejects(
    () =>
      repairFailure(
        new SdlcStageFailure('pnpm', ['e2e:run'], 1),
        async () => {
          throw Error('must not launch');
        },
        {},
        async () => 0,
        () => ({ suites: [] }),
      ),
    /No exact failed case/,
  );
  report.suites[0].specs[0].file = '../../unrelated.spec.ts';
  assert.throws(() => failedCases(report), /Unexpected test identity/);
});
