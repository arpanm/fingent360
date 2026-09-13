import { z } from 'zod';
import {
  catalog,
  emptyPortfolio,
  parseCsv,
  valuePortfolio,
  createReview,
  SaveInputSchema,
  PreviewInputSchema,
  PreviewSchema,
  ConfirmInputSchema,
  ReviewInputSchema,
  ReviewListSchema,
  ReviewSchema,
  WorkspaceSchema,
  SessionSchema,
  type PortfolioInput,
} from '@fingent360/contracts';
import {
  fail,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
} from './types';
type Workspace = z.infer<typeof WorkspaceSchema>;
interface LocalWorkspace {
  workspace: Workspace;
  previews: Record<
    string,
    {
      payload: z.infer<typeof PreviewSchema>;
      contentHash: string;
      createdAt: number;
    }
  >;
  mutations: Record<string, { payloadHash: string; response: Workspace }>;
  imports: Record<string, Workspace>;
  reviews: z.infer<typeof ReviewSchema>[];
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
function workspace(revision: number, portfolio: PortfolioInput) {
  return WorkspaceSchema.parse({
    revision,
    portfolio,
    valuation: valuePortfolio(portfolio),
  });
}
export async function handleJourney(
  req: OfflineRequest,
  state: LocalState,
): Promise<OfflineResult | undefined> {
  const prefix = '/api/v1/journey';
  if (!req.path.startsWith(`${prefix}/`)) return undefined;
  const route = req.path.slice(prefix.length);
  if (req.method === 'GET' && route === '/catalog') return { body: catalog };
  const all = (state.data.localWorkspaces ??= {}) as Record<
    string,
    LocalWorkspace
  >;
  if (req.method === 'POST' && route === '/workspaces') {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
    all[await hash(token)] = {
      workspace: workspace(0, structuredClone(emptyPortfolio)),
      previews: {},
      mutations: {},
      imports: {},
      reviews: [],
    };
    return { status: 201, body: SessionSchema.parse({ token }) };
  }
  const auth = req.headers.get('authorization');
  if (!auth || !/^Bearer [a-f0-9]{64}$/.test(auth))
    fail(401, 'Open a virtual workspace first.');
  const key = await hash(auth.slice(7));
  const record = all[key];
  if (!record)
    fail(401, 'Workspace expired or deleted. Open a new virtual workspace.');
  if (req.method === 'GET' && route === '/workspace')
    return { body: WorkspaceSchema.parse(record.workspace) };
  if (req.method === 'DELETE' && route === '/workspace') {
    delete all[key];
    return { body: { deleted: true } };
  }
  if (req.method === 'POST' && route === '/previews') {
    const input = PreviewInputSchema.parse(req.body);
    const parsed = parseCsv(input.csv);
    const calculatedTotal = valuePortfolio({
      holdings: parsed.holdings,
      cash: input.cash,
      goals: [],
    }).total;
    const issues = [...parsed.issues];
    if (calculatedTotal !== input.sourceTotal)
      issues.push(
        'Source total does not match calculated holdings plus cash. Correct the CSV or declared total.',
      );
    const result = PreviewSchema.parse({
      id: crypto.randomUUID(),
      holdings: parsed.holdings,
      cash: input.cash,
      sourceTotal: input.sourceTotal,
      calculatedTotal,
      matched: issues.length === 0,
      issues,
    });
    for (const [id, preview] of Object.entries(record.previews))
      if (preview.createdAt < Date.now() - 86400000) delete record.previews[id];
    if (Object.keys(record.previews).length >= 100)
      fail(
        400,
        'Preview limit reached. Try again tomorrow or delete this virtual workspace.',
      );
    const contentHash = await hash(
      JSON.stringify({
        holdings: parsed.holdings,
        cash: input.cash,
        sourceTotal: input.sourceTotal,
        parserVersion: 'simple-csv-v1',
      }),
    );
    record.previews[result.id] = {
      payload: result,
      contentHash,
      createdAt: Date.now(),
    };
    return { body: result, status: 201 };
  }
  if (
    req.method === 'POST' &&
    (route === '/workspace' || route === '/imports')
  ) {
    const input =
      route === '/workspace'
        ? SaveInputSchema.parse(req.body)
        : ConfirmInputSchema.parse(req.body);
    const payloadHash = await hash(JSON.stringify(input));
    const previous = record.mutations[input.idempotencyKey];
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        fail(409, 'Idempotency key was already used for different content.');
      return { body: WorkspaceSchema.parse(previous.response) };
    }
    let portfolio: PortfolioInput;
    let contentHash: string | undefined;
    if ('portfolio' in input) portfolio = input.portfolio;
    else {
      const preview = record.previews[input.previewId];
      if (!preview || preview.createdAt <= Date.now() - 86400000)
        fail(404, 'Preview not found or expired.');
      if (!preview.payload.matched)
        fail(400, 'Resolve all preview issues before confirming.');
      portfolio = {
        holdings: preview.payload.holdings,
        cash: preview.payload.cash,
        goals: record.workspace.portfolio.goals,
      };
      contentHash = preview.contentHash;
      if (record.imports[contentHash])
        fail(
          409,
          'This portfolio content was already imported. Reload the saved workspace; no changes were made.',
        );
    }
    if (record.workspace.revision !== input.expectedRevision)
      fail(
        409,
        'Workspace changed in another request. Reload saved data before editing.',
      );
    const saved = workspace(record.workspace.revision + 1, portfolio);
    record.workspace = structuredClone(saved);
    record.mutations[input.idempotencyKey] = {
      payloadHash,
      response: structuredClone(saved),
    };
    if (contentHash) record.imports[contentHash] = structuredClone(saved);
    return { body: saved };
  }
  if (req.method === 'POST' && route === '/reviews') {
    const input = ReviewInputSchema.parse(req.body);
    const review = createReview(
      record.workspace.portfolio,
      record.workspace.revision,
      input.scenario,
    );
    record.reviews.push(structuredClone(review));
    return { body: review, status: 201 };
  }
  if (req.method === 'GET' && route === '/reviews')
    return {
      body: ReviewListSchema.parse(
        [...record.reviews]
          .sort(
            (a, b) =>
              b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id),
          )
          .slice(0, 50),
      ),
    };
  const detail = route.match(/^\/reviews\/([^/]+)$/);
  if (req.method === 'GET' && detail) {
    const id = z.uuid().parse(detail[1]);
    const review = record.reviews.find((v) => v.id === id);
    if (!review) fail(404, 'Review not found.');
    return { body: ReviewSchema.parse(review) };
  }
  return undefined;
}
