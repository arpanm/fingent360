import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  DiscoveryIdSchema,
  EvidenceExplanationQuerySchema,
  FeedItemSchema,
  explainEdition,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { admitPublications } from './publication.js';

@Controller('discovery/items')
export class EvidenceExplanationsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get(':id/explanation')
  read(@Param('id') id: string, @Query() query: unknown) {
    const parsed = EvidenceExplanationQuerySchema.safeParse(query);
    if (!DiscoveryIdSchema.safeParse(id).success || !parsed.success)
      throw new BadRequestException('Invalid explanation edition.');
    return this.store.transaction(async (client) => {
      await client.query("SET LOCAL statement_timeout='5s'");
      const current = (await admitPublications(client, [id]))[0];
      if (!current || current.status !== 'published')
        throw new NotFoundException('This source explanation is unavailable.');
      if (current.version !== parsed.data.expectedVersion)
        throw new ConflictException(
          'This source edition changed. Refresh reading before opening its explanation.',
        );
      const rows = await client.query(
        "SELECT data FROM discovery_versions WHERE item_id=$1 AND version<$2 AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1",
        [id, current.version],
      );
      return explainEdition(
        current,
        rows.rows[0] ? FeedItemSchema.parse(rows.rows[0].data) : null,
        new Date().toISOString(),
      );
    });
  }
}
