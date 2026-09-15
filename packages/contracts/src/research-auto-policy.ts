import { z } from 'zod';
export const AutoPublicationSourceSchema = z.enum([
  'fed',
  'ecb-press',
  'pib',
  'bea',
]);
export const AutoPublicationInputSchema = z.strictObject({
  requestId: z.uuid(),
  sourceId: AutoPublicationSourceSchema,
  expectedVersion: z.number().int().nonnegative(),
  enabled: z.boolean(),
  expiresAt: z.iso.datetime(),
  rightsReviewed: z.literal(true),
  note: z.string().trim().min(20).max(1000),
});
const AuthoritySchema = z
  .strictObject({ id: z.uuid(), version: z.number().int().positive() })
  .nullable();
export const AutoPublicationPolicySchema = z.strictObject({
  id: z.uuid(),
  sourceId: AutoPublicationSourceSchema,
  version: z.number().int().positive(),
  enabled: z.boolean(),
  expiresAt: z.iso.datetime(),
  rightsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string(),
  proposer: AuthoritySchema,
  approver: AuthoritySchema,
  createdAt: z.iso.datetime(),
  approvedAt: z.iso.datetime().nullable(),
  state: z.enum(['pending', 'active', 'superseded']),
});
export const AutoPublicationPoliciesSchema = z.strictObject({
  policies: z.array(AutoPublicationPolicySchema).max(100),
  eligibleSources: z.array(
    z.strictObject({
      id: AutoPublicationSourceSchema,
      name: z.string(),
      termsUrl: z.url(),
      rights: z.string(),
    }),
  ),
});
