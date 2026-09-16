import { test, expect } from '../../helpers/app-fixture';
import { indiaActors } from '../../helpers/india-macro';
import { oilEducationInput, headers } from '../../helpers/oil-education';

test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1630 source upload transport admits declared large originals while ordinary and domain bounds remain enforced @DEV-010 @UX-002G @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = oilEducationInput();
    input.body =
      '<!--' + 'Synthetic inert padding. '.repeat(7000) + '-->' + input.body;
    expect(Buffer.byteLength(JSON.stringify(input))).toBeGreaterThan(102400);
    const captured = await request.post('/api/v1/ops/oil-education/capture', {
      headers,
      data: input,
    });
    expect(captured.status(), await captured.text()).toBe(201);
    const generic = await request.post('/api/v1/ops/oil-education/review', {
      headers,
      data: { padding: 'x'.repeat(110000) },
    });
    expect(generic.status()).toBe(413);
    const excessive = await request.post('/api/v1/ops/oil-education/capture', {
      headers,
      data: { ...oilEducationInput(), body: 'x'.repeat(1000001) },
    });
    expect(excessive.status()).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});
