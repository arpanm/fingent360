import { OperatorRead, OperatorAction } from './operator-permissions.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { MacroStore, MACRO_STORE } from './macro.js';
import { SourcesStore, SOURCE_STORE } from './sources.js';
@OperatorRead()
@Controller('ops')
export class OpsLegacyController {
  constructor(
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(MACRO_STORE) private readonly macro: MacroStore,
    @Inject(SOURCE_STORE) private readonly sources: SourcesStore,
  ) {}
  @OperatorAction('prepare')
  @Post('macro/refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    await this.ops.require(cookie);
    await this.ops.record('macro.refresh.requested', 'World Bank', cookie);
    return this.macro.refresh(body, this.ops.serverAuthorization(), () =>
      this.ops.permission(cookie, 'prepare'),
    );
  }
  @Get('sources') async list(@Headers('cookie') cookie?: string) {
    await this.ops.require(cookie);
    const result = await this.sources.list(
      true,
      this.ops.serverAuthorization(),
    );
    await this.ops.require(cookie);
    return result;
  }
  @Get('sources/:id/history') async history(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.ops.require(cookie);
    const result = await this.sources.history(
      id,
      this.ops.serverAuthorization(),
    );
    await this.ops.require(cookie);
    return result;
  }
  @OperatorAction('blocked')
  @Post('sources')
  async add(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    await this.ops.require(cookie);
    await this.ops.record('source.create.requested', 'new source', cookie);
    return this.sources.save(
      body,
      this.ops.serverAuthorization(),
      undefined,
      origin,
    );
  }
  @OperatorAction('blocked')
  @Put('sources/:id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    await this.ops.require(cookie);
    await this.ops.record('source.update.requested', id, cookie);
    return this.sources.save(body, this.ops.serverAuthorization(), id, origin);
  }
}
