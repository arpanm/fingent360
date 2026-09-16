import {
  test,
  expect,
  indiaActors,
  indiaReview,
  retentionHeaders,
} from '../../helpers/india-gdp';
test.use({ namedOperators: true, indiaGdpArchiveSimulation: true });
test('E2E-API-1790 archive month retains actual draft and independently publishes legacy source timestamp @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const body = {
      month: '2026-08',
      rightsEvidence:
        'Synthetic archive permission evidence for isolated regression only.',
      rightsConfirmed: true,
    };
    const response = await request.post('/api/v1/ops/india-macro/gdp-archive', {
      headers: retentionHeaders,
      data: body,
    });
    expect(response.status()).toBe(201);
    const receipt = await response.json();
    expect(receipt.results).toHaveLength(1);
    const evidence = await request.get(
      '/api/v1/ops/india-macro/archive-evidence/' + receipt.captureHash,
    );
    expect(evidence.status()).toBe(200);
    expect(await evidence.json()).toMatchObject({
      indexHash: receipt.indexHash,
      retrievedAt: receipt.retrievedAt,
      index: { month: '2026-08' },
    });
    expect(receipt.results[0].status).toBe('retained');
    const duplicate = await request.post(
      '/api/v1/ops/india-macro/gdp-archive',
      { headers: retentionHeaders, data: body },
    );
    expect((await duplicate.json()).results[0].id).toBe(receipt.results[0].id);
    const editionId = receipt.results[0].id;
    const publish = await reviewer.post('/api/v1/ops/india-macro/review', {
      headers: retentionHeaders,
      data: indiaReview(editionId),
    });
    expect(publish.status()).toBe(201);
    const data = await (await request.get('/api/v1/india-macro')).json();
    const found = data.gdp.editions.find(
      (row: { id: string }) => row.id === editionId,
    );
    expect(found.publishedAt).toBe('2026-08-31T10:30:00.000Z');
    expect(found.sourceUrl).toContain(
      'archive.pib.gov.in/archive2/erelcontent.aspx?relid=294102',
    );
    expect(found.rightsEvidence).toBeUndefined();
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1791 mismatched archive month quarantines exact original instead of admitting a vintage @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const response = await request.post('/api/v1/ops/india-macro/gdp-archive', {
      headers: retentionHeaders,
      data: {
        month: '2026-07',
        rightsEvidence: 'Synthetic mismatched month permission evidence.',
        rightsConfirmed: true,
      },
    });
    expect(response.status()).toBe(201);
    const result = await response.json();
    expect(result.results[0].status).toBe('quarantined');
    expect(result.results[0].reason).toContain('outside requested month');
    expect(
      (
        await request.get(
          `/api/v1/ops/india-macro/attempts/${result.results[0].id}/evidence`,
        )
      ).status(),
    ).toBe(200);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1792 future archive month is a client error before provider discovery @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const response = await request.post('/api/v1/ops/india-macro/gdp-archive', {
      headers: retentionHeaders,
      data: {
        month: '2099-01',
        rightsEvidence: 'Synthetic future month validation only.',
        rightsConfirmed: true,
      },
    });
    expect(response.status()).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});
