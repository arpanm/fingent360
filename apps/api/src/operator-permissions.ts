import {
  SetMetadata,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { OperatorStore } from './operator.js';
import type { OperatorPermission } from './named-operator-store.js';
const ACTION = 'f360.operator.action',
  READ = 'f360.operator.read',
  LEGACY = 'f360.operator.legacy';
export const OperatorRead = () => SetMetadata(READ, true);
export const OperatorAction = (permission: OperatorPermission) =>
  SetMetadata(ACTION, permission);
export const LegacyOperatorRoute = () => SetMetadata(LEGACY, true);
/** Named mode is default-deny for every Operations mutation, including newly added handlers. */
export class OperatorPermissionGuard implements CanActivate {
  constructor(private readonly store: OperatorStore) {}
  async canActivate(context: ExecutionContext) {
    if (!this.store.namedMode) return true;
    const controller = context.getClass(),
      handler = context.getHandler();
    if (Reflect.getMetadata(LEGACY, handler))
      throw new ForbiddenException(
        'Legacy bearer administration is disabled in named mode. Use Operations.',
      );
    const path: unknown = Reflect.getMetadata(PATH_METADATA, controller);
    const paths = (Array.isArray(path) ? path : [path]).filter(
      (value): value is string => typeof value === 'string',
    );
    const protectedPaths = paths
      .map((value) => value.replace(/^\/+|\/+$/g, ''))
      .filter((value) => value === 'ops' || value.startsWith('ops/'));
    if (!protectedPaths.length) return true;
    if (protectedPaths.every((value) => value === 'ops/session')) return true;
    const request = context.switchToHttp().getRequest<{
      method: string;
      headers: { cookie?: string; origin?: string };
    }>();
    const permission: OperatorPermission | undefined = Reflect.getMetadata(
      ACTION,
      handler,
    );
    if (
      request.method === 'GET' &&
      (Reflect.getMetadata(READ, handler) ||
        Reflect.getMetadata(READ, controller))
    ) {
      await this.store.permission(request.headers.cookie, 'read');
      return true;
    }
    if (!permission)
      throw new ForbiddenException(
        'This operation is not enabled for named roles.',
      );
    this.store.origin(request.headers.origin);
    await this.store.permission(request.headers.cookie, permission);
    return true;
  }
}
