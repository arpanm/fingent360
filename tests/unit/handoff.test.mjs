import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import HandoffReporter, { redact } from '../e2e/reporters/handoff.mjs';

test('manual run evidence includes failures and replaces latest on the next run', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'f360-handoff-'));
  try {
    const reporter = new HandoffReporter({ directory });
    assert.deepEqual(readdirSync(directory), []);
    const suite = { allTests: () => [1, 2] };
    reporter.onBegin(
      { metadata: { apiTarget: 'http://127.0.0.1:4102' } },
      suite,
    );
    const example = {
      titlePath: () => ['api', 'E2E-API-002'],
      location: { file: 'foundation.spec.ts', line: 31 },
      expectedStatus: 'passed',
    };
    reporter.onTestEnd(example, {
      status: 'failed',
      retry: 0,
      errors: [{ message: 'Expected 200; received 503' }],
    });
    reporter.onTestEnd(
      { ...example, titlePath: () => ['api', 'E2E-API-004'] },
      {
        status: 'skipped',
        retry: 0,
        errors: [],
      },
    );
    reporter.onEnd({ status: 'failed' });
    const latest = () =>
      readFileSync(path.join(directory, 'latest.md'), 'utf8');
    assert.match(latest(), /Expected 200; received 503/);
    assert.match(latest(), /foundation.spec.ts:31/);
    assert.match(latest(), /skipped: api > E2E-API-004/);
    reporter.onBegin({ metadata: {} }, { allTests: () => [1] });
    reporter.onTestEnd(example, { status: 'passed', retry: 0, errors: [] });
    reporter.onEnd({ status: 'passed' });
    assert.doesNotMatch(latest(), /received 503/);
    assert.match(latest(), /Status: passed/);
    assert.equal(readdirSync(path.join(directory, 'handoffs')).length, 2);
    reporter.onError({ message: 'Worker disconnected' });
    reporter.onEnd({ status: 'interrupted' });
    assert.match(latest(), /Worker disconnected/);
    assert.match(latest(), /Status: interrupted/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('handoff redacts known secrets and common credential formats', () => {
  const result = redact(
    'private-value Bearer abc123 password=unsafe\npostgres://user:pass@localhost/db',
    ['private-value'],
  );
  for (const secret of ['private-value', 'abc123', 'unsafe', 'user:pass']) {
    assert.ok(!result.includes(secret));
  }
});
