import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PlatformVouchersService } from './platform-vouchers.service';
import {
  VoucherActionDto,
  VoucherInputDto,
  VoucherListQueryDto,
  VoucherPreviewDto,
  VoucherUpdateDto,
} from './voucher.dto';

@ApiTags('Admin Platform Vouchers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('PROMOTION_MANAGEMENT')
@Controller('admin/campaigns')
export class AdminVouchersController {
  constructor(private readonly vouchers: PlatformVouchersService) {}

  @Get()
  list(@Query() query: VoucherListQueryDto) {
    return this.vouchers.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.vouchers.get(id);
  }

  @Get(':id/redemptions')
  redemptions(@Param('id') id: string, @Query('page') page?: string) {
    const parsed = Number(page ?? '1');
    return this.vouchers.redemptions(
      id,
      Number.isInteger(parsed) && parsed > 0 ? parsed : 1,
    );
  }

  @Post(':id/preview')
  preview(@Param('id') id: string, @Body() input: VoucherPreviewDto) {
    return this.vouchers.previewAdmin(id, input);
  }

  @Post()
  create(
    @Body() input: VoucherInputDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.vouchers.create(input, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: VoucherUpdateDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.vouchers.update(id, input, actor);
  }

  @Post(':id/activate')
  activate(
    @Param('id') id: string,
    @Body() input: VoucherActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.vouchers.action(id, 'activate', input, actor);
  }

  @Post(':id/pause')
  pause(
    @Param('id') id: string,
    @Body() input: VoucherActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.vouchers.action(id, 'pause', input, actor);
  }

  @Post(':id/end')
  end(
    @Param('id') id: string,
    @Body() input: VoucherActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.vouchers.action(id, 'end', input, actor);
  }
}
