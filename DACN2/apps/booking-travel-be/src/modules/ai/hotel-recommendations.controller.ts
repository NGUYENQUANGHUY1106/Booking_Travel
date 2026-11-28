import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { HotelRecommendationQueryDto } from './dto/hotel-recommendation-query.dto';
import { HotelRecommendationsService } from './hotel-recommendations.service';

@ApiTags('AI')
@Controller('ai/hotel-recommendations')
export class HotelRecommendationsController {
  constructor(private readonly recommendations: HotelRecommendationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Public()
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  list(
    @Query() input: HotelRecommendationQueryDto,
    @Headers('x-recommendation-account') expectedAccount?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (expectedAccount && expectedAccount !== user?.id) {
      throw new ForbiddenException('Tài khoản đã thay đổi.');
    }
    return this.recommendations.list(input, user);
  }
}
