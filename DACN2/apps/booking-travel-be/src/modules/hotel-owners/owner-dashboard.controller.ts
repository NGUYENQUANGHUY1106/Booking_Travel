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
import {
  OWNER_DASHBOARD_HOTELS_SCHEMA,
  OWNER_DASHBOARD_RESPONSE_SCHEMA,
} from './dto/owner-dashboard-response.schema';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  OwnerDashboardHotelsQueryDto,
  OwnerDashboardQueryDto,
} from './dto/owner-dashboard-query.dto';
import { OwnerDashboardService } from './owner-dashboard.service';

@ApiTags('Owner Dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, expired or revoked session; inactive account.',
})
@ApiForbiddenResponse({
  description: 'Requires a verified, active HOTEL_OWNER.',
})
@ApiBadRequestResponse({
  description: 'Invalid query, dates or timezone; ownerId cannot be supplied.',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
@Controller('owner/dashboard')
export class OwnerDashboardController {
  constructor(private readonly dashboard: OwnerDashboardService) {}

  @Get('hotels')
  @ApiOkResponse({ schema: OWNER_DASHBOARD_HOTELS_SCHEMA })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Paginated hotel selector scoped to the authenticated Owner, including non-public hotels.',
  })
  hotels(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerDashboardHotelsQueryDto,
  ) {
    return this.dashboard.hotels(user.id, query);
  }

  @Get()
  @ApiOkResponse({ schema: OWNER_DASHBOARD_RESPONSE_SCHEMA })
  @ApiNotFoundResponse({
    description:
      'Selected hotel does not exist, is deleted or belongs to another owner.',
  })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Owner dashboard (ST-OWN-03)',
    description:
      'Counts created bookings in the inclusive date range and the equally sized preceding period. Operational actions use today in timeZone. Missing financial, inventory, review, inbox and AI domains return unavailable/null, never fabricated zero metrics. See docs/OWN-03.md.',
  })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerDashboardQueryDto,
  ) {
    return this.dashboard.dashboard(user.id, query);
  }
}
