import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { HotelStaySearchQueryDto } from '../hotels/dto/hotel-stay-search-query.dto';
import { TravelHistoryService } from './travel-history.service';

function accountId(user: AuthenticatedUser, expected?: string) {
  if (expected && expected !== user.id)
    throw new ForbiddenException('Tài khoản đã thay đổi.');
  return user.id;
}

class UpdateTravelHistoryConsentDto {
  @IsBoolean()
  enabled!: boolean;
}

class RecordViewedHotelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  hotelId!: string;
}

@ApiTags('Travel history')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users/me/travel-history')
export class TravelHistoryController {
  constructor(private readonly history: TravelHistoryService) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.get(accountId(user, expected));
  }

  @Put('consent')
  consent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateTravelHistoryConsentDto,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.consent(accountId(user, expected), input.enabled);
  }

  @Post('searches')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: HotelStaySearchQueryDto,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.recordSearch(accountId(user, expected), input);
  }

  @Post('hotels')
  hotel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RecordViewedHotelDto,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.recordHotel(accountId(user, expected), input.hotelId);
  }

  @Delete('searches/:id')
  deleteSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.deleteSearch(accountId(user, expected), id);
  }

  @Delete('hotels/:hotelId')
  deleteHotel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.deleteHotel(accountId(user, expected), hotelId);
  }

  @Delete()
  clear(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-travel-history-account') expected?: string,
  ) {
    return this.history.clear(accountId(user, expected));
  }
}
