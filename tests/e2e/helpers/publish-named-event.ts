import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import {
  EventPublicSchema,
  PublicationProposalSchema,
} from '../../../packages/contracts/src/index';
import { retentionHeaders } from './retention';

/** Publish through the same independent proposal workflow used by Operations. */
export async function publishNamedEvent(
  proposer: APIRequestContext,
  reviewer: APIRequestContext,
  eventId: string,
  note: string,
) {
  const body = {
    requestId: randomUUID(),
    expectedVersion: 1,
    status: 'published',
    note,
  };
  const legacy = await reviewer.post(`/api/v1/ops/events/${eventId}/review`, {
    headers: retentionHeaders,
    data: body,
  });
  expect(legacy.status()).toBe(403);
  const id = randomUUID();
  const proposal = await proposer.put(`/api/v1/ops/proposals/${id}`, {
    headers: retentionHeaders,
    data: { kind: 'event', target: eventId, body },
  });
  expect(proposal.status()).toBe(200);
  const pending = PublicationProposalSchema.parse(await proposal.json());
  expect(pending.state).toBe('pending');
  const selfApproval = await proposer.post(
    `/api/v1/ops/proposals/${id}/approve`,
    {
      headers: retentionHeaders,
      data: { note },
    },
  );
  expect(selfApproval.status()).toBe(403);
  const approved = await reviewer.post(`/api/v1/ops/proposals/${id}/approve`, {
    headers: retentionHeaders,
    data: { note },
  });
  expect(approved.status()).toBe(201);
  const receipt = PublicationProposalSchema.parse(await approved.json());
  expect(receipt.state).toBe('approved');
  expect(receipt.input).toEqual({ kind: 'event', target: eventId, body });
  expect(receipt.reviewer).not.toBeNull();
  expect(receipt.reviewer?.id).not.toBe(receipt.proposer.id);
  const publicResponse = await proposer.get('/api/v1/events/' + eventId);
  expect(publicResponse.status()).toBe(200);
  const event = EventPublicSchema.parse(await publicResponse.json());
  expect(event.id).toBe(eventId);
  expect(event.status).toBe('published');
  expect(event.event?.version).toBe(2);
  return event;
}
