import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.notifications.list(userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUserId() userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch('read-all')
  readAll(@CurrentUserId() userId: string) {
    return this.notifications.readAll(userId);
  }

  @Patch(':id/read')
  readOne(
    @CurrentUserId() userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notifications.markRead(userId, notificationId);
  }

  @Post('device-tokens')
  registerDevice(
    @CurrentUserId() userId: string,
    @Body() input: RegisterDeviceTokenDto,
  ) {
    return this.notifications.registerDevice(userId, input);
  }

  @Delete('device-tokens/:token')
  revokeDevice(@CurrentUserId() userId: string, @Param('token') token: string) {
    return this.notifications.revokeDevice(userId, decodeURIComponent(token));
  }
}
