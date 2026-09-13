import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { createWorkbookParser } from '../dist/workbook.js';
const bytes = new Uint8Array();
const reply = {
  result: { holdings: [], declaredTotalMinor: '0', declaredRowCount: 0 },
};
const create = (source) => new Worker(source, { eval: true });
test('XLSX-001 zero exit and malformed reply reject without waiting indefinitely', async () => {
  await assert.rejects(
    createWorkbookParser(() => create('process.exit(0)'), 1000)(bytes),
    /exited before/,
  );
  await assert.rejects(
    createWorkbookParser(
      () =>
        create(
          "require('node:worker_threads').parentPort.postMessage({result:{holdings:[]}})",
        ),
      1000,
    )(bytes),
    /invalid result/,
  );
});
test('XLSX-001 worker timeout terminates and returns capacity for later attempts', async () => {
  const workers = [];
  const parse = createWorkbookParser(() => {
    const w = create('setInterval(()=>{},1000)');
    workers.push(w);
    return w;
  }, 30);
  await Promise.all([
    assert.rejects(parse(bytes), /timed out/),
    assert.rejects(parse(bytes), /timed out/),
  ]);
  assert.equal(workers.length, 2);
  assert.ok(workers.every((w) => w.threadId === -1));
  await assert.rejects(parse(bytes), /timed out/);
  assert.equal(workers.length, 3);
  assert.equal(workers[2].threadId, -1);
});
test('XLSX-001 constructor failures cannot exhaust capacity', async () => {
  let attempts = 0;
  const parse = createWorkbookParser(() => {
    attempts++;
    throw Error('synthetic constructor failure');
  });
  for (let i = 0; i < 4; i++)
    await assert.rejects(parse(bytes), /synthetic constructor/);
  assert.equal(attempts, 4);
});
test('XLSX-001 success retains capacity until asynchronous termination settles', async () => {
  const release = [];
  const reached = [];
  const spawn = () => {
    const w = create(
      `require('node:worker_threads').parentPort.postMessage(${JSON.stringify(reply)});setInterval(()=>{},1000)`,
    );
    const terminate = w.terminate.bind(w);
    w.terminate = () => {
      const stopped = terminate();
      return new Promise((resolve) => {
        release.push(async () => resolve(await stopped));
        reached.shift()?.();
      });
    };
    return w;
  };
  const parse = createWorkbookParser(spawn, 1000);
  const entered = () => new Promise((resolve) => reached.push(resolve));
  const firstEntered = entered(),
    secondEntered = entered();
  const one = parse(bytes),
    two = parse(bytes);
  try {
    await Promise.all([firstEntered, secondEntered]);
    await assert.rejects(parse(bytes), /busy/);
  } finally {
    await Promise.all(release.map((fn) => fn()));
  }
  assert.deepEqual(await one, reply.result);
  assert.deepEqual(await two, reply.result);
});
