import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
  CreateOwnerHotelDraftDto,
  UpdateOwnerHotelProfileDto,
} from './dto/owner-hotel-profile.dto';
import { HotelsService } from './hotels.service';
import { HotelMediaService } from './hotel-media.service';
import { OwnerHotelWizardService } from './owner-hotel-wizard.service';
import {
  CoverHotelImageDto,
  FinalizeHotelImageDto,
  HotelVersionDto,
  PresignHotelImageDto,
  ReorderHotelImagesDto,
  SubmitHotelDto,
  UpdateHotelAmenitiesDto,
  UpdateHotelLocationDto,
} from './dto/owner-hotel-wizard.dto';

@ApiTags('Owner hotels')
@Roles(UserRole.HOTEL_OWNER)
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('owner/hotels')
export class OwnerHotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly wizard: OwnerHotelWizardService,
    private readonly media: HotelMediaService,
  ) {}

  @Get('catalog/amenities')
  catalog() {
    return this.wizard.catalog();
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.hotels.listOwnerProfiles(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotels.getOwnerProfile(id, user);
  }

  @Get(':id/submission-readiness')
  readiness(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotels.getOwnerProfile(id, user);
  }

  @Post()
  create(
    @Body() input: CreateOwnerHotelDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotels.createOwnerDraft(user, input);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateOwnerHotelProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotels.updateOwnerProfile(id, user, input);
  }

  @Patch(':id/location')
  location(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateHotelLocationDto,
  ) {
    return this.wizard.location(id, user, input);
  }

  @Put(':id/amenities')
  amenities(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateHotelAmenitiesDto,
  ) {
    return this.wizard.amenities(id, user, input);
  }

  @Post(':id/media/presign')
  presign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: PresignHotelImageDto,
  ) {
    return this.media.presign(id, user, input.mimeType, input.sizeBytes);
  }

  @Get(':id/rooms/:roomId/media')
  roomMedia(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.media.listRoomMetadata(id, roomId, user);
  }

  @Post(':id/rooms/:roomId/media/presign')
  presignRoomMedia(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: PresignHotelImageDto,
  ) {
    return this.media.presign(
      id,
      user,
      input.mimeType,
      input.sizeBytes,
      roomId,
    );
  }

  @Post(':id/rooms/:roomId/media/finalize')
  async finalizeRoomMedia(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: FinalizeHotelImageDto,
  ) {
    await this.media.finalize(id, user, input.mediaId, roomId);
    return this.media.listRoomMetadata(id, roomId, user);
  }

  @Delete(':id/rooms/:roomId/media/:mediaId')
  removeRoomMedia(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.media.removeRoomMedia(id, roomId, mediaId, user);
  }

  @Post(':id/media/finalize')
  async finalize(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: FinalizeHotelImageDto,
  ) {
    await this.media.finalize(id, user, input.mediaId);
    return this.hotels.getOwnerProfile(id, user);
  }

  @Patch(':id/media/cover')
  async cover(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CoverHotelImageDto,
  ) {
    await this.media.setCover(id, user, input.mediaId, input.expectedVersion);
    return this.hotels.getOwnerProfile(id, user);
  }

  @Put(':id/media/order')
  async order(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ReorderHotelImagesDto,
  ) {
    await this.media.reorder(id, user, input.mediaIds, input.expectedVersion);
    return this.hotels.getOwnerProfile(id, user);
  }

  @Delete(':id/media/:mediaId')
  async removeMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: HotelVersionDto,
  ) {
    await this.media.remove(id, user, mediaId, input.expectedVersion);
    return this.hotels.getOwnerProfile(id, user);
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: SubmitHotelDto,
  ) {
    return this.wizard.submit(id, user, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotels.remove(id, user);
  }
}
