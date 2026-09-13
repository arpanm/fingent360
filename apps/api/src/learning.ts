import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
} from '@nestjs/common';
import {
  LearningCatalogSchema,
  LearningSubmitSchema,
  LearningAttemptSchema,
  LearningVoteSchema,
  LearningStateSchema,
  LearningSuggestionsSchema,
  SavedGoalSchema,
  HoldingsSnapshotSchema,
  type LearningQuestion,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
const revision = 'glossary-dev001-v1' as const;
// Rubrics are authored against the repository glossary, not generated from live prices.
const items: LearningQuestion[] = LearningCatalogSchema.parse({
  items: [
    {
      id: 'isin-meaning',
      version: 1,
      kind: 'quiz',
      title: 'Know the identifier',
      prompt: 'What does an ISIN identify?',
      choices: [
        { id: 'security', text: 'A security or investment instrument' },
        { id: 'account', text: 'Your personal brokerage account' },
        { id: 'price', text: 'The current market price' },
      ],
      source: {
        title: 'Fingent360 product glossary · ISIN',
        revision,
        excerpt:
          'Security identifier used in matching; not a user account or an exchange-specific ticker.',
      },
    },
    {
      id: 'reconciliation',
      version: 1,
      kind: 'quiz',
      title: 'Check before saving',
      prompt: 'Your CSV was parsed successfully. What still needs checking?',
      choices: [
        {
          id: 'totals',
          text: 'Its quantities and totals against the source records',
        },
        {
          id: 'nothing',
          text: 'Nothing: parsing proves every number is correct',
        },
        { id: 'returns', text: 'Whether it guarantees a profit' },
      ],
      source: {
        title: 'Fingent360 product glossary · Reconciliation',
        revision,
        excerpt:
          'Comparing imported/calculated values against source totals under a stated rule; not assuming an upload is correct because parsing succeeded.',
      },
    },
    {
      id: 'learning-interest',
      version: 1,
      kind: 'poll',
      title: 'What would you like to understand?',
      prompt: 'Choose the topic you would like explained next.',
      choices: [
        { id: 'sources', text: 'Checking financial sources' },
        { id: 'holdings', text: 'Understanding my holdings' },
        { id: 'goals', text: 'Planning for a goal' },
      ],
      source: {
        title: 'Fingent360 learning preference poll',
        revision,
        excerpt:
          'Voluntary learning interests only. Responses are not a market forecast, recommendation or representative survey.',
      },
    },
  ],
}).items;
const rubrics: Record<string, { answer: string; explanation: string }> = {
  'isin-meaning': {
    answer: 'security',
    explanation:
      'An ISIN identifies a security. A valid check digit alone does not verify your ownership, the issuer record or a market price.',
  },
  reconciliation: {
    answer: 'totals',
    explanation:
      'Parsing checks the format. Reconciliation separately checks quantities and totals against the source under a stated rule.',
  },
};
export function learningGrade(questionId: string, choiceId: string) {
  const question = items.find((q) => q.id === questionId && q.kind === 'quiz');
  if (!question || !question.choices.some((c) => c.id === choiceId))
    throw new BadRequestException('Choose a listed answer for this question.');
  return {
    correct: rubrics[questionId]!.answer === choiceId,
    explanation: rubrics[questionId]!.explanation,
  };
}
@Controller('learning')
export class LearningController {
  @Get('catalog') catalog() {
    return LearningCatalogSchema.parse({ items });
  }
}
@Controller('account/learning')
export class AccountLearningController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get('state') state(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      const attempts = await c.query(
        'SELECT payload FROM app_learning_attempts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
        [user.id],
      );
      const votes = await c.query(
        'SELECT question_id,question_version,choice_id,voted_at FROM app_learning_votes WHERE user_id=$1',
        [user.id],
      );
      const counts = await c.query(
        'SELECT question_id,question_version,choice_id,count(*)::integer AS count FROM app_learning_votes GROUP BY question_id,question_version,choice_id',
      );
      return LearningStateSchema.parse({
        attempts: attempts.rows.map((r) => r.payload),
        votes: votes.rows.map((r) => ({
          questionId: r.question_id,
          version: r.question_version,
          choiceId: r.choice_id,
          votedAt: r.voted_at.toISOString(),
        })),
        polls: items
          .filter((q) => q.kind === 'poll')
          .map((q) => {
            const rows = counts.rows.filter(
              (r) => r.question_id === q.id && r.question_version === q.version,
            );
            return {
              questionId: q.id,
              version: q.version,
              total: rows.reduce((n, r) => n + r.count, 0),
              counts: q.choices.map((choice) => ({
                choiceId: choice.id,
                count: rows.find((r) => r.choice_id === choice.id)?.count ?? 0,
              })),
            };
          }),
      });
    });
  }
  private input(body: unknown, kind: 'quiz' | 'poll') {
    const parsed = LearningSubmitSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Submit the listed question version, choice and consent.',
      );
    const input = parsed.data;
    const question = items.find(
      (q) =>
        q.id === input.questionId &&
        q.version === input.version &&
        q.kind === kind,
    );
    if (!question || !question.choices.some((c) => c.id === input.choiceId))
      throw new BadRequestException(
        'Question or choice is unavailable. Reload learning.',
      );
    return input;
  }
  @Post('attempts') attempt(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = this.input(body, 'quiz');
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      const previous = await c.query(
        'SELECT payload,question_id,choice_id,question_version FROM app_learning_attempts WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      );
      if (previous.rows[0]) {
        const p = previous.rows[0];
        if (
          p.question_id !== input.questionId ||
          p.choice_id !== input.choiceId ||
          p.question_version !== input.version
        )
          throw new ConflictException(
            'This submission identifier was already used.',
          );
        return LearningAttemptSchema.parse(p.payload);
      }
      const recent = await c.query(
        "SELECT count(*)::integer AS count FROM app_learning_attempts WHERE user_id=$1 AND created_at>now()-interval '1 hour'",
        [user.id],
      );
      if (recent.rows[0].count >= 60)
        throw new BadRequestException(
          'Take a break and return to the quiz in an hour.',
        );
      const result = LearningAttemptSchema.parse({
        id: randomUUID(),
        questionId: input.questionId,
        version: input.version,
        choiceId: input.choiceId,
        ...learningGrade(input.questionId, input.choiceId),
        sourceRevision: revision,
        answeredAt: new Date().toISOString(),
      });
      await c.query(
        'INSERT INTO app_learning_attempts(id,user_id,request_id,question_id,question_version,choice_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          result.id,
          user.id,
          input.requestId,
          input.questionId,
          input.version,
          input.choiceId,
          result,
        ],
      );
      return result;
    });
  }
  @Post('vote') vote(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = this.input(body, 'poll');
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      const result = await c.query(
        'INSERT INTO app_learning_votes(user_id,question_id,question_version,choice_id) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,question_id,question_version) DO UPDATE SET choice_id=excluded.choice_id,voted_at=now() RETURNING voted_at',
        [user.id, input.questionId, input.version, input.choiceId],
      );
      return LearningVoteSchema.parse({
        questionId: input.questionId,
        version: input.version,
        choiceId: input.choiceId,
        votedAt: result.rows[0].voted_at.toISOString(),
      });
    });
  }
  @Get('suggestions') suggestions(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      const goals = await c.query(
        'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.updated_at DESC LIMIT 1',
        [user.id],
      );
      const holdings = await c.query(
        'SELECT r.payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
        [user.id],
      );
      const suggestions: unknown[] = [];
      if (goals.rows[0]) {
        const g = SavedGoalSchema.parse(goals.rows[0].payload);
        suggestions.push({
          kind: 'goal',
          sourceId: g.id,
          sourceVersion: g.version,
          sourceName: g.name,
          savedAt: g.updatedAt,
          values: {
            type: g.type,
            monthlyMinor: g.monthlyMinor,
            horizonMonths: g.horizonMonths,
          },
        });
      }
      if (holdings.rows[0]) {
        const snapshot = HoldingsSnapshotSchema.parse(holdings.rows[0].payload);
        for (const row of snapshot.holdings.slice(0, 3))
          suggestions.push({
            kind: 'holding',
            sourceId: row.isin,
            sourceVersion: snapshot.version,
            sourceName: row.isin,
            savedAt: snapshot.updatedAt,
            values: row,
          });
      }
      return LearningSuggestionsSchema.parse({
        suggestions,
        basis: 'your-saved-input-only',
      });
    });
  }
}
