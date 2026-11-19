import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WishlistNameDto } from './dto/wishlist-name.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites and wishlists')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
@Controller('wishlists')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.favorites.list(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() input: WishlistNameDto) {
    return this.favorites.create(userId, input.name);
  }

  @Patch(':wishlistId')
  rename(
    @CurrentUserId() userId: string,
    @Param('wishlistId') wishlistId: string,
    @Body() input: WishlistNameDto,
  ) {
    return this.favorites.rename(userId, wishlistId, input.name);
  }

  @Delete(':wishlistId')
  removeList(
    @CurrentUserId() userId: string,
    @Param('wishlistId') wishlistId: string,
  ) {
    return this.favorites.removeList(userId, wishlistId);
  }

  @Put(':wishlistId/hotels/:hotelId')
  save(
    @CurrentUserId() userId: string,
    @Param('wishlistId') wishlistId: string,
    @Param('hotelId') hotelId: string,
  ) {
    return this.favorites.save(userId, wishlistId, hotelId);
  }

  @Delete(':wishlistId/hotels/:hotelId')
  unsave(
    @CurrentUserId() userId: string,
    @Param('wishlistId') wishlistId: string,
    @Param('hotelId') hotelId: string,
  ) {
    return this.favorites.unsave(userId, wishlistId, hotelId);
  }
}
