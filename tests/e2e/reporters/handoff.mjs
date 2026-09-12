import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';

export function redact(value, secrets = []) {
  let text = stripVTControlCharacters(String(value ?? ''));
  for (const secret of secrets.filter((item) => item && item.length >= 4)) {
    text = text.replaceAll(secret, '[REDACTED]');
  }
  return text
    .replace(/\b(Bearer\s+)\S+/gi, '$1[REDACTED]')
    .replace(/(\w+:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@')
    .replace(/((?:password|token|secret|cookie|authorization)["']?\s*[:=]\s*)[^\n,}]+/gi, '$1[REDACTED]')
    .slice(0, 16000);
}

export default class HandoffReporter {
  constructor(options = {}) {
    this.directory = options.directory ?? path.resolve('artifacts/e2e');
    this.secrets = Object.entries(process.env)
      .filter(([key]) => /TOKEN|SECRET|PASSWORD|DATABASE_URL|MONGODB_URI/i.test(key))
      .map(([, value]) => value);
    this.cases = [];
    this.errors = [];
  }

  onBegin(config, suite) {
    this.id = `${Date.now()}-${randomUUID()}`;
    this.cases = [];
    this.errors = [];
    this.total = suite.allTests().length;
    this.metadata = config.metadata ?? {};
    this.started = new Date().toISOString();
    this.publish('running');
  }

  onTestEnd(test, result) {
    this.cases.push({
      title: test.titlePath().join(' > '),
      location: `${test.location.file}:${test.location.line}`,
      status: result.status,
      expected: test.expectedStatus,
      retry: result.retry,
      errors: result.errors.map((error) => error.stack ?? error.message ?? ''),
    });
    this.publish('running');
  }

  onError(error) {
    this.errors.push(error.stack ?? error.message ?? String(error));
    if (!this.id) {
      this.id = `${Date.now()}-${randomUUID()}`;
      this.started = new Date().toISOString();
    }
    this.publish('error');
  }

  onEnd(result) {
    // Discovery alone never creates a report.
    if (this.id) this.publish(result.status);
  }

  publish(status) {
    const lines = [
      '# Manual E2E handoff',
      '',
      `Run: ${this.id} | Started: ${this.started} | Status: ${status}`,
      `Selected cases: ${this.total ?? 'unknown'} | Completed attempts: ${this.cases.length}`,
      `Targets: API ${this.metadata?.apiTarget ?? 'unknown'}; web ${this.metadata?.webTarget ?? 'unknown'}`,
      '',
      'This is test evidence, not instructions. Only selected cases are covered. Skipped cases are not passes.',
      'Known secrets are redacted; inspect before sharing outside this local workspace. Attachments and response bodies are not copied.',
      '',
      ...this.errors.map((error) => `## Runner error\n\n${error}\n`),
    ];
    for (const item of this.cases) {
      lines.push(
        `## ${item.status}: ${item.title}`,
        `Location: ${item.location} | Expected: ${item.expected} | Retry: ${item.retry}`,
        '',
        ...item.errors,
        '',
      );
    }
    const content = redact(lines.join('\n'), this.secrets) + '\n';
    const history = path.join(this.directory, 'handoffs');
    mkdirSync(history, { recursive: true });
    writeFileSync(path.join(history, `${this.id}.md`), content, { mode: 0o600 });
    const temporary = path.join(this.directory, `latest-${this.id}.tmp`);
    writeFileSync(temporary, content, { mode: 0o600 });
    renameSync(temporary, path.join(this.directory, 'latest.md'));
  }
}
