import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrivateMediaService } from '../../infrastructure/storage/private-media.service';
import { PresignOwnerDocumentDto } from './dto/presign-owner-document.dto';

@ApiTags('Private owner documents')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER)
@Controller('media')
export class MediaController {
  constructor(private readonly media: PrivateMediaService) {}

  @Post('presign')
  presign(
    @CurrentUserId() userId: string,
    @Body() input: PresignOwnerDocumentDto,
  ) {
    return this.media.presign(
      userId,
      input.purpose,
      input.mimeType,
      input.sizeBytes,
    );
  }

  @Post(':id/finalize')
  finalize(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.media.finalize(userId, id);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.media.remove(userId, id);
  }
}
