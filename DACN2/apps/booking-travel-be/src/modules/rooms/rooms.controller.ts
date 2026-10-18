import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@UseGuards(AccessTokenGuard, RolesGuard, OwnershipGuard)
@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('hotels/:hotelId/rooms')
  @Public()
  listByHotel(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.rooms.listByHotel(hotelId, user);
  }

  @Get('rooms/:id')
  @Public()
  get(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.rooms.get(id, user);
  }

  @Post('hotels/:hotelId/rooms')
  @Roles(UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'hotel', param: 'hotelId' })
  create(
    @Param('hotelId') hotelId: string,
    @Body() input: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rooms.create(hotelId, user, input);
  }

  @Patch('rooms/:id')
  @Roles(UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'room', param: 'id' })
  update(
    @Param('id') id: string,
    @Body() input: UpdateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rooms.update(id, user, input);
  }

  @Delete('rooms/:id')
  @HttpCode(204)
  @Roles(UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'room', param: 'id' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rooms.remove(id, user);
  }
}
