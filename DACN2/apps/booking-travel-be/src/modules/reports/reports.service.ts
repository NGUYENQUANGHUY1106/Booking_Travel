import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  HotelReportStatus,
  HotelStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CreateHotelReportDto } from './dto/create-hotel-report.dto';
import type { CreateContentReportDto } from './dto/create-content-report.dto';

const adminReportSelect = {
  id: true,
  reason: true,
  description: true,
  evidenceUrls: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  hotel: {
    select: { id: true, name: true, addressLine: true, province: true },
  },
  booking: {
    select: {
      id: true,
      code: true,
      status: true,
      checkIn: true,
      checkOut: true,
      roomNameSnapshot: true,
    },
  },
  reporter: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
} satisfies Prisma.HotelReportSelect;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContentReport(reporterId: string, input: CreateContentReportDto) {
    if (input.targetType !== 'REVIEW')
      throw new BadRequestException(
        'Hiện chưa có nội dung chat công khai để báo cáo.',
      );
    if (input.reason === 'OTHER' && !input.description)
      throw new BadRequestException('Vui lòng mô tả lý do khác.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Review" WHERE id = ${input.targetId} FOR SHARE`;
        const review = await tx.review.findFirst({
          where: {
            id: input.targetId,
            hiddenAt: null,
            hotel: {
              status: HotelStatus.APPROVED,
              isVisible: true,
              deletedAt: null,
            },
          },
          select: { id: true, userId: true, comment: true, deletedAt: true },
        });
        if (!review)
          throw new NotFoundException('Không tìm thấy đánh giá công khai.');
        if (review.deletedAt) return { status: 'ALREADY_HANDLED' as const };
        if (review.userId === reporterId)
          throw new BadRequestException(
            'Bạn không thể báo cáo đánh giá của chính mình.',
          );
        const report = await tx.reviewReport.create({
          data: {
            reviewId: review.id,
            reporterId,
            reason: input.reason,
            description: input.description,
            snapshot: review.comment,
          },
          select: { id: true, reason: true, status: true, createdAt: true },
        });
        return {
          ...report,
          targetType: 'REVIEW' as const,
          targetId: review.id,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Bạn đã báo cáo đánh giá này.');
      throw error;
    }
  }

  async listReviewReports(cursor?: string) {
    const limit = 20;
    const items = await this.prisma.reviewReport.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        reviewId: true,
        reporterId: true,
        reason: true,
        description: true,
        snapshot: true,
        status: true,
        createdAt: true,
        review: {
          select: {
            hotel: { select: { name: true } },
            deletedAt: true,
            hiddenAt: true,
          },
        },
      },
    });
    const page = items.slice(0, limit);
    return {
      items: page,
      nextCursor: items.length > limit ? page.at(-1)?.id : null,
    };
  }

  async create(user: AuthenticatedUser, input: CreateHotelReportDto) {
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: input.hotelId,
        status: HotelStatus.APPROVED,
        isVisible: true,
        deletedAt: null,
      },
      select: { id: true, ownerId: true },
    });
    if (!hotel)
      throw new NotFoundException('Không tìm thấy khách sạn công khai.');
    if (hotel.ownerId === user.id)
      throw new ForbiddenException(
        'Không thể báo cáo khách sạn của chính mình.',
      );
    const booking = await this.prisma.booking.findFirst({
      where: { id: input.bookingId, userId: user.id },
      select: { id: true, hotelId: true, status: true },
    });
    if (!booking)
      throw new NotFoundException('Không tìm thấy booking của bạn.');
    if (booking.hotelId !== input.hotelId)
      throw new BadRequestException('Khách sạn không khớp với booking.');
    if (booking.status !== BookingStatus.COMPLETED)
      throw new ForbiddenException(
        'Chỉ khách đã hoàn thành kỳ lưu trú mới được báo cáo khách sạn.',
      );
    // Evidence is accepted only through a verified upload flow. Arbitrary URLs are unsafe.
    if (input.evidenceUrls?.length)
      throw new BadRequestException(
        'Bằng chứng dạng tệp chưa được hỗ trợ ở biểu mẫu này. Hãy mô tả trong nội dung báo cáo.',
      );

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`report:${input.hotelId}:${user.id}`}))`;
        const existing = await tx.hotelReport.findFirst({
          where: {
            hotelId: input.hotelId,
            reporterId: user.id,
            status: {
              in: [HotelReportStatus.OPEN, HotelReportStatus.IN_REVIEW],
            },
          },
          select: { id: true },
        });
        if (existing)
          throw new ConflictException(
            'Bạn đã có báo cáo khách sạn này đang được xử lý.',
          );
        return tx.hotelReport.create({
          data: {
            bookingId: booking.id,
            hotelId: hotel.id,
            reporterId: user.id,
            reason: input.reason,
            description: input.description.trim(),
            evidenceUrls: input.evidenceUrls ?? [],
          },
          select: {
            id: true,
            bookingId: true,
            hotelId: true,
            reason: true,
            status: true,
            createdAt: true,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Booking này đã gửi báo cáo khách sạn.');
      }
      throw error;
    }
  }

  listForAdmin() {
    return this.prisma.hotelReport.findMany({
      select: adminReportSelect,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getForAdmin(id: string) {
    const report = await this.prisma.hotelReport.findUnique({
      where: { id },
      select: adminReportSelect,
    });
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo.');
    return report;
  }
}
