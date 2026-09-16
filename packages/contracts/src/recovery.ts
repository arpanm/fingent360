import { z } from 'zod';
import { PasswordSchema, UsernameSchema } from './account.js';
export const RecoveryCodeSchema = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v.replace(/[\s-]/g, '').toLowerCase())
  .pipe(z.string().regex(/^[a-f0-9]{64}$/));
export const RecoveryGenerateSchema = z.strictObject({
  currentPassword: PasswordSchema,
  authenticatorCode: z
    .string()
    .regex(/^[0-9]{6}$/)
    .optional(),
  confirm: z.literal(true),
});
export const RecoveryResetSchema = z.strictObject({
  username: UsernameSchema,
  code: RecoveryCodeSchema,
  newPassword: PasswordSchema,
});
export const RecoveryStatusSchema = z.strictObject({
  configured: z.boolean(),
  createdAt: z.iso.datetime().nullable(),
});
export const RecoveryCreatedSchema = z.strictObject({
  code: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(),
});
export const RecoveryResultSchema = z.strictObject({ ok: z.literal(true) });
