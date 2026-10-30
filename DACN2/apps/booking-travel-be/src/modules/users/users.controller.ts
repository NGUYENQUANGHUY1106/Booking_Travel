import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateAvatarUploadDto } from './dto/create-avatar-upload.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'ST-USR-01 - Xem hồ sơ cá nhân' })
  @ApiOkResponse({ description: 'Hồ sơ của tài khoản đang đăng nhập.' })
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'ST-USR-01 - Cập nhật hồ sơ cá nhân' })
  @ApiOkResponse({ description: 'Hồ sơ sau khi cập nhật.' })
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.id, input);
  }

  @Post('me/avatar-upload')
  @ApiOperation({ summary: 'ST-USR-01 - Tạo URL tải ảnh đại diện lên R2' })
  @ApiOkResponse({ description: 'Presigned URL và URL công khai của avatar.' })
  createAvatarUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateAvatarUploadDto,
  ) {
    return this.users.createAvatarUpload(user.id, input);
  }
}
