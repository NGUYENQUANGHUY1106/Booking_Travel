import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertHotelOwner(
    hotelId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    if (user.role !== UserRole.HOTEL_OWNER || hotel.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không sở hữu khách sạn này.');
    }
  }

  async assertRoomOwner(
    roomId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, deletedAt: null, hotel: { deletedAt: null } },
      select: { hotel: { select: { ownerId: true } } },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng.');
    if (user.role !== UserRole.HOTEL_OWNER || room.hotel.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không sở hữu phòng này.');
    }
  }

  async assertBookingAccess(
    bookingId: string,
    user: AuthenticatedUser,
    action: 'read' | 'manage',
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true, hotel: { select: { ownerId: true } } },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');

    const ownerCanAccess =
      user.role === UserRole.HOTEL_OWNER && booking.hotel.ownerId === user.id;
    const customerCanRead =
      action === 'read' &&
      (user.role === UserRole.USER || user.role === UserRole.HOTEL_OWNER) &&
      booking.userId === user.id;
    const adminCanAccess =
      user.role === UserRole.ADMIN &&
      user.permissions.includes('BOOKING_SUPPORT');
    if (!ownerCanAccess && !customerCanRead && !adminCanAccess) {
      throw new ForbiddenException('Bạn không có quyền truy cập booking này.');
    }
  }
}
