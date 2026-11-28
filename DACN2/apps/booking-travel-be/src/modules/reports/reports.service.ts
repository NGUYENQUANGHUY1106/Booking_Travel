import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelReportStatus, HotelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CreateHotelReportDto } from './dto/create-hotel-report.dto';

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
    const booking = input.bookingId
      ? await this.prisma.booking.findFirst({
          where: { id: input.bookingId, userId: user.id },
          select: { id: true, hotelId: true, status: true },
        })
      : null;
    if (input.bookingId && !booking)
      throw new NotFoundException('Không tìm thấy booking của bạn.');
    if (booking && booking.hotelId !== input.hotelId)
      throw new BadRequestException('Khách sạn không khớp với booking.');
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
            bookingId: booking?.id,
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
