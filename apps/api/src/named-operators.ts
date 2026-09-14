import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Headers,
  Inject,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
@OperatorRead()
@Controller('ops/operators')
export class NamedOperatorsController {
  constructor(@Inject(OPERATOR_STORE) private readonly ops: OperatorStore) {}
  private enabled() {
    if (!this.ops.namedMode)
      throw new ForbiddenException(
        'Enable named mode explicitly before managing identities.',
      );
  }
  @Get()
  list(@Headers('cookie') cookie?: string) {
    this.enabled();
    return this.ops.named.roster(cookie);
  }
  @OperatorAction('administer')
  @Post()
  create(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.enabled();
    this.ops.origin(origin);
    return this.ops.named.create(body, cookie);
  }
  @OperatorAction('administer')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.enabled();
    this.ops.origin(origin);
    return this.ops.named.update(id, body, cookie);
  }
}
