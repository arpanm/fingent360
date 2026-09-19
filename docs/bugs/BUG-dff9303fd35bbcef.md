# BUG-dff9303fd35bbcef

- Status: Open
- Case/project: E2E-WEB-134 / desktop
- Stories: UX-002, UX-002D
- First seen: 2026-09-19T16:49:29.201Z
- Evidence: artifacts/sdlc/1789836492361-20464/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:5176
    Call log:
      - → GET http://127.0.0.1:5176/api/v1/discovery/feed?kind=term
        - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Safari/537.36
        - accept: */*
        - accept-encoding: gzip,deflate,br


       7 | });
       8 | async function publishedTerm(page: Page) {
    >  9 |   const response = await page.request.get('/api/v1/discovery/feed?kind=term');
         |                                       ^
      10 |   expect(response.status()).toBe(200);
      11 |   const item = FeedSchema.parse(await response.json()).items[0];
      12 |   expect(
        at publishedTerm (/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/discovery-quality.spec.ts:9:39)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/discovery-quality.spec.ts:77:22
