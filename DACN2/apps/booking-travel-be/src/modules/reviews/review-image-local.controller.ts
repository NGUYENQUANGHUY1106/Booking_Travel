import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { HotelStatus } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReviewImageLocalService } from '../../infrastructure/storage/review-image-local.service';
import { AvatarLocalController } from '../media/avatar-local.controller';

@Controller('review-images')
export class ReviewImageLocalController extends AvatarLocalController {
  constructor(
    images: ReviewImageLocalService,
    private readonly prisma: PrismaService,
  ) {
    super(images);
  }

  @Get(':id/content')
  override async read(@Param('id') id: string, @Res() response: Response) {
    const review = await this.prisma.review.findFirst({
      where: {
        images: { has: `/api/review-images/${id}/content` },
        hotel: {
          status: HotelStatus.APPROVED,
          isVisible: true,
          deletedAt: null,
        },
      },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Không tìm thấy ảnh đánh giá.');
    return super.read(id, response);
  }
}
