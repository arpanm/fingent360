import { z } from 'zod';
export const OperatorRoleSchema = z.enum([
  'viewer',
  'researcher',
  'publisher',
  'admin',
]);
export type OperatorRole = z.infer<typeof OperatorRoleSchema>;
export const OperatorIdentitySchema = z.strictObject({
  id: z.uuid(),
  username: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/),
  role: OperatorRoleSchema,
  version: z.number().int().positive(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
});
