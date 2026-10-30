import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UpdateTravelPreferencesDto } from './dto/update-travel-preferences.dto';
import { TravelPreferencesService } from './travel-preferences.service';

@ApiTags('User Travel Preferences')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users/me/travel-preferences')
export class TravelPreferencesController {
  constructor(private readonly preferences: TravelPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'ST-USR-02 - Xem Travel Preference Profile' })
  @ApiOkResponse({ description: 'Travel Preference Profile hiện tại.' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.preferences.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'ST-USR-02 - Thiết lập Travel Preference Profile' })
  @ApiOkResponse({ description: 'Travel Preference Profile sau khi lưu.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateTravelPreferencesDto,
  ) {
    return this.preferences.update(user.id, input);
  }

  @Delete()
  @ApiOperation({ summary: 'ST-USR-02 - Reset Travel Preference Profile' })
  @ApiOkResponse({
    description: 'Travel Preference Profile mặc định sau khi reset.',
  })
  reset(@CurrentUser() user: AuthenticatedUser) {
    return this.preferences.reset(user.id);
  }
}
