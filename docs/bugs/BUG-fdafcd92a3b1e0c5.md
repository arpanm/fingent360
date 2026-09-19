# BUG-fdafcd92a3b1e0c5

- Status: Resolved
- Case/project: E2E-API-1920 / api
- Stories: SRC-017
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      58 |     );
      59 |     expect(rows.editions[0]?.terms.isin).toBe('IN0020250091');
    > 60 |     expect((await request.get(ops + '/evidence/terms')).status()).toBe(200);
         |                                                                   ^
      61 |     const url = '/api/v1/sovereign-bonds/' + input.requestId + '/calculate';
      62 |     const response = await request.post(url, {
      63 |       data: { nominalPaise: '1000000', price: 'cutoff' },
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/sovereign-bond.spec.ts:60:67
