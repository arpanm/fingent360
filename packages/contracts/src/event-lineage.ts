import { z } from 'zod';
import { EventEditorialSchema, EventRevisionSchema } from './events.js';

export const EventLineageInputSchema = z
  .strictObject({
    kind: z.enum(['merge', 'split']),
    inputs: z
      .array(
        z.strictObject({
          id: z.uuid(),
          version: z.number().int().positive().max(2147483647),
        }),
      )
      .min(1)
      .max(5),
    outputs: z
      .array(z.strictObject({ id: z.uuid(), editorial: EventEditorialSchema }))
      .min(1)
      .max(5),
    reason: z.string().trim().min(10).max(1000),
  })
  .superRefine((value, context) => {
    const valid =
      value.kind === 'merge'
        ? value.inputs.length >= 2 && value.outputs.length === 1
        : value.inputs.length === 1 && value.outputs.length >= 2;
    const ids = [...value.inputs, ...value.outputs].map((item) =>
      item.id.toLowerCase(),
    );
    if (!valid || new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        message:
          'Merge needs 2–5 inputs and 1 output; split needs 1 input and 2–5 outputs. Every event identity must be distinct.',
      });
  });
export const EventLineagePlanSchema = z
  .strictObject({
    id: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.iso.datetime(),
    input: EventLineageInputSchema,
    originals: z.array(EventRevisionSchema).min(1).max(5),
    outputs: z.array(EventRevisionSchema).min(1).max(5),
  })
  .superRefine((value, context) => {
    if (
      value.originals.some(
        (item) =>
          item.graph.events[0]?.publicationState !== 'published' ||
          Date.parse(item.recordedAt) > Date.parse(value.createdAt),
      ) ||
      value.outputs.some(
        (item) =>
          item.recordedAt !== value.createdAt ||
          item.graph.events[0]?.publicationState !== 'candidate',
      ) ||
      value.originals.length !== value.input.inputs.length ||
      value.outputs.length !== value.input.outputs.length ||
      value.input.inputs.some(
        (item, index) =>
          value.originals[index]?.id !== item.id ||
          value.originals[index]?.version !== item.version,
      ) ||
      value.input.outputs.some(
        (item, index) =>
          value.outputs[index]?.id !== item.id ||
          value.outputs[index]?.version !== 1 ||
          JSON.stringify(value.outputs[index]?.editorial) !==
            JSON.stringify(item.editorial),
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'Lineage plan must bind its exact original revisions and complete output editorials.',
      });
  });
export const EventLineageReviewSchema = z.strictObject({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export const EventLineageReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reviewedAt: z.iso.datetime(),
    kind: z.enum(['merge', 'split']),
    inputs: z.array(z.uuid()).min(1).max(5),
    outputs: z.array(z.uuid()).min(1).max(5),
    reason: z.string().min(10).max(1000),
  })
  .superRefine((value, context) => {
    const ids = [...value.inputs, ...value.outputs].map((id) =>
      id.toLowerCase(),
    );
    const cardinality =
      value.kind === 'merge'
        ? value.inputs.length >= 2 && value.outputs.length === 1
        : value.inputs.length === 1 && value.outputs.length >= 2;
    if (!cardinality || new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        message:
          'Receipt must preserve distinct exact merge or split membership.',
      });
  });
export const EventLineageOperationsSchema = z
  .strictObject({
    plan: EventLineagePlanSchema,
    receipt: EventLineageReceiptSchema.nullable(),
  })
  .superRefine(({ plan, receipt }, context) => {
    if (!receipt) return;
    if (
      receipt.id !== plan.id ||
      receipt.fingerprint !== plan.fingerprint ||
      receipt.kind !== plan.input.kind ||
      receipt.reason !== plan.input.reason ||
      Date.parse(receipt.reviewedAt) < Date.parse(plan.createdAt) ||
      JSON.stringify(receipt.inputs) !==
        JSON.stringify(plan.input.inputs.map((item) => item.id)) ||
      JSON.stringify(receipt.outputs) !==
        JSON.stringify(plan.input.outputs.map((item) => item.id))
    )
      context.addIssue({
        code: 'custom',
        message:
          'Application receipt must bind this exact immutable plan and follow its creation.',
      });
  });
export const EventLineageListSchema = z.strictObject({
  plans: z.array(EventLineageOperationsSchema).max(20),
  next: z.uuid().nullable(),
});
export const EventLineagePublicSchema = z
  .strictObject({
    eventId: z.uuid(),
    relations: z
      .array(
        z.strictObject({
          id: z.uuid(),
          kind: z.enum(['merge', 'split']),
          direction: z.enum(['replaced-by', 'derived-from']),
          reviewedAt: z.iso.datetime(),
          reason: z.string().min(10).max(2000),
          related: z
            .array(
              z.strictObject({
                id: z.uuid(),
                available: z.boolean(),
                title: z.string().max(200).nullable(),
              }),
            )
            .min(1)
            .max(5),
        }),
      )
      .max(2),
    evaluatedAt: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    const ids = value.relations.map((row) => row.id.toLowerCase());
    const directions = value.relations.map((row) => row.direction);
    const allRelated = value.relations.flatMap((row) =>
      row.related.map((item) => item.id.toLowerCase()),
    );
    const invalid =
      new Set(allRelated).size !== allRelated.length ||
      new Set(ids).size !== ids.length ||
      new Set(directions).size !== directions.length ||
      value.relations.some((row) => {
        const related = row.related.map((item) => item.id.toLowerCase());
        const single =
          (row.kind === 'merge') === (row.direction === 'replaced-by');
        return (
          (single ? related.length !== 1 : related.length < 2) ||
          new Set(related).size !== related.length ||
          related.includes(value.eventId.toLowerCase()) ||
          row.related.some((item) =>
            item.available ? !item.title?.trim() : item.title !== null,
          )
        );
      });
    if (invalid)
      context.addIssue({
        code: 'custom',
        message:
          'Public lineage must have distinct valid membership and disclose titles only for available targets.',
      });
  });
