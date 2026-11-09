import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreateInventoryBlockDto,
  InventoryMonthDto,
  ReleaseInventoryBlockDto,
  SetInventoryOverrideDto,
  UpdateInventoryBlockDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Owner room inventory')
@Roles(UserRole.HOTEL_OWNER)
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('owner/hotels/:hotelId/rooms/:roomId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  month(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Query() query: InventoryMonthDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.month(user, hotelId, roomId, query.month);
  }

  @Post('blocks')
  createBlock(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() input: CreateInventoryBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.createBlock(user, hotelId, roomId, input);
  }

  @Patch('blocks/:blockId')
  updateBlock(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Param('blockId') blockId: string,
    @Body() input: UpdateInventoryBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.updateBlock(user, hotelId, roomId, blockId, input);
  }

  @Delete('blocks/:blockId')
  releaseBlock(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Param('blockId') blockId: string,
    @Body() input: ReleaseInventoryBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.releaseBlock(user, hotelId, roomId, blockId, input);
  }

  @Put('override')
  setOverride(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() input: SetInventoryOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.setOverride(user, hotelId, roomId, input);
  }
}
