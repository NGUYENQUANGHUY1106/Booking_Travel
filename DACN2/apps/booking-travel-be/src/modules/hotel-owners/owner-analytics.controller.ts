import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OwnerAnalyticsQueryDto } from './dto/owner-analytics-query.dto';
import { OwnerAnalyticsService } from './owner-analytics.service';

@ApiTags('Owner Analytics')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or expired session.' })
@ApiForbiddenResponse({ description: 'Requires HOTEL_OWNER.' })
@ApiBadRequestResponse({
  description: 'Invalid range, timezone or unsupported currency.',
})
@ApiNotFoundResponse({
  description: 'Hotel or room is not owned by this account.',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
@Controller('owner/analytics')
export class OwnerAnalyticsController {
  constructor(private readonly analytics: OwnerAnalyticsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({
    description:
      'VND analytics; null ratios mean insufficient denominator. See docs/analytics-metrics.md.',
    schema: {
      type: 'object',
      required: [
        'version',
        'currency',
        'asOf',
        'scope',
        'summary',
        'points',
        'rooms',
        'rating',
        'roomOptions',
        'limitations',
      ],
      properties: {
        version: { type: 'string', example: 'owner-analytics-v1' },
        currency: { type: 'string', example: 'VND' },
        asOf: { type: 'string', format: 'date-time' },
        sourceFreshness: { type: 'object' },
        scope: {
          type: 'object',
          description:
            'hotelId, hotelName, roomId, dateFrom, dateTo, granularity and timeZone',
        },
        summary: {
          type: 'object',
          description:
            'bookedValue, collected, refunded, netCollected, soldRoomNights, sellableRoomNights, occupancyPercent, adr, bookingCount, cancelledCount, cancellationPercent',
        },
        points: {
          type: 'array',
          items: {
            type: 'object',
            description:
              'label, bucketStart, bucketEndExclusive and the same metrics as summary',
          },
        },
        rooms: {
          type: 'array',
          items: {
            type: 'object',
            description: 'room id, current name and metrics',
          },
        },
        roomOptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, name: { type: 'string' } },
          },
        },
        rating: {
          type: 'object',
          description:
            'score and count are null until public review data exists',
        },
        limitations: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiOperation({
    summary: 'Owner-scoped financial and room analytics, ST-OWN-14',
  })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.analytics.get(user.id, query);
  }
}
