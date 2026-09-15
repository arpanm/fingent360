import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' });

export function impactBaseline(root, ref = 'HEAD', read = git) {
  // Resolve once before the workflow commits. Invalid refs must stop, not select zero tests.
  return read(root, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${ref}^{commit}`,
  ]).trim();
}

export function impactChanges(root, base, read = git) {
  return [
    ...new Set(
      [
        ...read(root, [
          'diff',
          '--name-only',
          '--no-renames',
          '-z',
          base,
          '--',
        ]).split('\0'),
        ...read(root, [
          'ls-files',
          '--others',
          '--exclude-standard',
          '-z',
        ]).split('\0'),
      ].filter(Boolean),
    ),
  ].sort();
}

export function caseInventory(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && file.endsWith('.spec.ts')) files.push(file);
    }
  };
  visit('tests/e2e/cases');
  for (const group of ['api', 'browser', 'offline']) {
    if (!files.some((file) => file.startsWith(`tests/e2e/cases/${group}/`)))
      throw Error(
        `No ${group} cases found; refusing incomplete impact inventory.`,
      );
  }
  return files.sort();
}

export function selectImpact(changed, inventory, present = () => true) {
  const selected = new Set();
  const reasons = [];
  const include = (prefix) =>
    inventory
      .filter((file) => file.startsWith(prefix))
      .forEach((file) => selected.add(file));
  const all = () => include('tests/e2e/cases/');
  if (!changed.length) {
    all();
    reasons.push(
      'No changes against baseline: unknown validation history, selecting full coverage. Use --base for committed changes.',
    );
  }
  for (const file of changed) {
    if (
      file.startsWith('tests/e2e/cases/') &&
      file.endsWith('.spec.ts') &&
      inventory.includes(file) &&
      present(file)
    ) {
      selected.add(file);
      reasons.push(`${file}: changed case file`);
    } else if (
      /^(README\.md|TODO\.md|docs\/.*\.md|tests\/e2e\/(README\.md|CATALOG\.md|plans\/.*\.md))$/.test(
        file,
      )
    ) {
      reasons.push(`${file}: documentation only; no E2E`);
    } else if (file.startsWith('tests/unit/') && file.endsWith('.test.mjs')) {
      reasons.push(`${file}: unit case covered by unchanged pnpm check gate`);
    } else if (file.startsWith('apps/web/src/offline/')) {
      include('tests/e2e/cases/offline/');
      reasons.push(`${file}: offline implementation; all offline cases`);
    } else if (file.startsWith('apps/web/')) {
      include('tests/e2e/cases/browser/');
      include('tests/e2e/cases/offline/');
      reasons.push(
        `${file}: shared web/app surface; all desktop/mobile/offline cases`,
      );
    } else {
      all();
      reasons.push(
        `${file}: shared, deleted test, configuration or unmapped dependency; full fallback`,
      );
    }
  }
  const files = [...selected].sort();
  return {
    changed,
    reasons,
    connected: files.filter(
      (file) => !file.startsWith('tests/e2e/cases/offline/'),
    ),
    offline: files.filter((file) =>
      file.startsWith('tests/e2e/cases/offline/'),
    ),
  };
}

export function makeImpactPlan(root, base) {
  return {
    base,
    ...selectImpact(impactChanges(root, base), caseInventory(root), (file) =>
      existsSync(path.join(root, file)),
    ),
  };
}

export function caseFilters(files) {
  // Playwright treats positional paths as regexes. Anchor escaped literal paths.
  return files.map((file) => `${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}
