import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
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
    const booking = await this.prisma.booking.findFirst({
      where: { id: input.bookingId, userId: user.id },
      select: { id: true, hotelId: true, status: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking của bạn.');
    }
    if (booking.hotelId !== input.hotelId) {
      throw new BadRequestException('Khách sạn không khớp với booking.');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ForbiddenException(
        'Chỉ khách đã hoàn thành kỳ lưu trú mới được báo cáo khách sạn.',
      );
    }

    try {
      return await this.prisma.hotelReport.create({
        data: {
          bookingId: booking.id,
          hotelId: booking.hotelId,
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
