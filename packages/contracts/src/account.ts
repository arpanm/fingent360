import { z } from 'zod';
import { MacroIndicatorSchema, MacroValueSchema } from './macro.js';
export const UsernameSchema = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{2,31}$/);
export const PasswordSchema = z.string().min(12).max(128);
export const CredentialsSchema = z.strictObject({ username: UsernameSchema, password: PasswordSchema });
export const RegistrationSchema = z.strictObject({ username: UsernameSchema, password: PasswordSchema, consent: z.literal(true) });
export const AccountSchema = z.strictObject({ id: z.uuid(), username: UsernameSchema, consentVersion: z.literal('account-storage-v1'), createdAt: z.iso.datetime() });
export const CurrentAccountSchema = z.strictObject({ user: AccountSchema.nullable() });
export const WatchlistSchema = z.strictObject({ indicators: z.array(MacroIndicatorSchema).max(2).refine((v) => new Set(v).size === v.length, 'Duplicate indicators are not allowed') });
export const DeleteAccountSchema = z.strictObject({ password: PasswordSchema });
export const AccountActionSchema = z.strictObject({ ok: z.literal(true) });
export type Account = z.infer<typeof AccountSchema>;

export const InboxItemSchema = z.strictObject({
  indicator: MacroIndicatorSchema, observationId: z.uuid(), year: z.number().int(),
  value: MacroValueSchema.nullable(), revision: z.number().int().positive(), retrievedAt: z.iso.datetime(),
  kind: z.enum(['observation', 'correction']), read: z.boolean(), sourceUrl: z.url(),
});
export const InboxSchema = z.strictObject({ items: z.array(InboxItemSchema).max(2) });
export const AcknowledgeSchema = z.strictObject({ observationId: z.uuid() });
export type InboxItem = z.infer<typeof InboxItemSchema>;
