import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import {
  OperatorPermissionGuard,
  OperatorRead,
} from '../dist/operator-permissions.js';

function context(paths, method = 'POST') {
  class Controller {}
  function handler() {}
  Reflect.defineMetadata(PATH_METADATA, paths, Controller);
  return {
    Controller,
    handler,
    value: {
      getClass: () => Controller,
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ method, headers: {} }) }),
    },
  };
}
test('named mode denies unannotated mutations through an ops controller alias', async () => {
  const guard = new OperatorPermissionGuard({ namedMode: true });
  for (const paths of [
    'ops/new-feature',
    ['public-alias', 'ops/new-feature'],
    ['ops/session', 'ops/new-feature'],
    ['/public-alias', '/ops/new-feature/'],
  ]) {
    await assert.rejects(guard.canActivate(context(paths).value), {
      status: 403,
    });
  }
});
test('handler protected reads require named identity without enabling other methods', async () => {
  let admitted = 0;
  const guard = new OperatorPermissionGuard({
    namedMode: true,
    permission: async (_cookie, permission) => {
      assert.equal(permission, 'read');
      admitted++;
    },
  });
  const input = context('ops/new-feature', 'GET');
  OperatorRead()(input.handler);
  assert.equal(await guard.canActivate(input.value), true);
  assert.equal(admitted, 1);
  const mutation = context('ops/new-feature');
  OperatorRead()(mutation.handler);
  await assert.rejects(guard.canActivate(mutation.value), { status: 403 });
  await assert.rejects(
    new OperatorPermissionGuard({
      namedMode: true,
      permission: async () => {
        throw new Error('Named identity required');
      },
    }).canActivate(input.value),
    /Named identity required/,
  );
});
test('aliased protected reads still require identity and bootstrap remains compatible', async () => {
  let admitted = 0;
  const guard = new OperatorPermissionGuard({
    namedMode: true,
    permission: async () => {
      admitted++;
    },
  });
  const input = context(['public-alias', 'ops/new-feature'], 'GET');
  OperatorRead()(input.Controller);
  assert.equal(await guard.canActivate(input.value), true);
  assert.equal(admitted, 1);
  assert.equal(
    await new OperatorPermissionGuard({ namedMode: false }).canActivate(
      context('ops/new-feature').value,
    ),
    true,
  );
});
