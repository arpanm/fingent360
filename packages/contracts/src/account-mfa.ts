import { z } from 'zod';
import { PasswordSchema } from './account.js';
export const MfaStatusSchema = z.strictObject({
  enabled: z.boolean(),
  pending: z.boolean(),
});
export const MfaStartSchema = z.strictObject({ password: PasswordSchema });
export const MfaConfirmSchema = z.strictObject({
  password: PasswordSchema,
  code: z.string().regex(/^[0-9]{6}$/),
});
export const MfaEnrollmentSchema = z.strictObject({
  secret: z.string().regex(/^[A-Z2-7]{32}$/),
  uri: z.string().startsWith('otpauth://totp/'),
  expiresAt: z.iso.datetime(),
});
