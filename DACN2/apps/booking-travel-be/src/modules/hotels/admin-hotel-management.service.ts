import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  HotelStatus,
  HotelSubmissionStatus,
  Prisma,
  RoomStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { HotelMediaService } from './hotel-media.service';
import { hotelSubmissionReadiness } from './hotel-submission-readiness';
import {
  AdminHotelDecisionDto,
  AdminHotelListDto,
} from './dto/admin-hotel-management.dto';

const activeBookingStatuses = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

function vietnamToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (part: string) =>
    parts.find((item) => item.type === part)?.value;
  return new Date(
    `${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`,
  );
}

@Injectable()
export class AdminHotelManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: HotelMediaService,
  ) {}

  async ownerRestrictions(hotelId: string, ownerId: string) {
    return this.prisma.hotelRestrictionAudit.findMany({
      where: { hotelId, ownerId },
      select: {
        id: true,
        action: true,
        afterStatus: true,
        afterVisible: true,
        reason: true,
        createdAt: true,
        futureBookingCount: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async list(query: AdminHotelListDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();
    const where: Prisma.HotelWhereInput = {
      deletedAt: null,
      ownerId: query.ownerId || undefined,
      status: query.status,
      AND:
        query.visibility === 'VISIBLE'
          ? [{ status: HotelStatus.APPROVED, isVisible: true }]
          : query.visibility === 'HIDDEN'
            ? [
                {
                  OR: [
                    { status: HotelStatus.SUSPENDED },
                    { status: HotelStatus.APPROVED, isVisible: false },
                  ],
                },
              ]
            : undefined,
      accommodationType: query.type,
      province: query.province
        ? { contains: query.province.trim(), mode: 'insensitive' }
        : undefined,
      OR: search
        ? [
            { id: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { owner: { fullName: { contains: search, mode: 'insensitive' } } },
            { owner: { email: { contains: search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [total, hotels] = await this.prisma.$transaction([
      this.prisma.hotel.count({ where }),
      this.prisma.hotel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: {
          owner: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          _count: {
            select: {
              rooms: { where: { deletedAt: null } },
              bookings: {
                where: {
                  status: { in: activeBookingStatuses },
                  checkOut: { gt: vietnamToday() },
                },
              },
            },
          },
        },
      }),
    ]);
    const galleries = await this.media.listMetadata(
      hotels.map((hotel) => hotel.id),
      'admin',
    );
    return {
      items: hotels.map((hotel) => ({
        id: hotel.id,
        name: hotel.name,
        status: hotel.status,
        isVisible: hotel.isVisible,
        restrictionVersion: hotel.restrictionVersion,
        profileVersion: hotel.profileVersion,
        accommodationType: hotel.accommodationType,
        addressLine: hotel.addressLine,
        province: hotel.province,
        city: hotel.city,
        updatedAt: hotel.updatedAt,
        owner: hotel.owner,
        roomCount: hotel._count.rooms,
        futureBookingCount: hotel._count.bookings,
        coverImageUrl:
          galleries.get(hotel.id)?.find((image) => image.isCover)?.url ??
          hotel.coverImageUrl,
      })),
      total,
      page,
      limit,
    };
  }

  async detail(id: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            isActive: true,
            ownerApplication: { select: { status: true } },
            ownerProfile: { select: { isActive: true } },
          },
        },
        policy: true,
        amenityLinks: {
          select: { amenityId: true, amenity: { select: { name: true } } },
        },
        rooms: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            quantity: true,
            basePrice: true,
            capacityAdults: true,
            capacityChildren: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        bookings: {
          where: {
            status: { in: activeBookingStatuses },
            checkOut: { gt: vietnamToday() },
          },
          select: {
            id: true,
            code: true,
            status: true,
            checkIn: true,
            checkOut: true,
          },
          orderBy: [{ checkIn: 'asc' }, { id: 'asc' }],
          take: 30,
        },
        submissions: {
          select: {
            id: true,
            version: true,
            status: true,
            submittedAt: true,
            decidedAt: true,
          },
          orderBy: { version: 'desc' },
          take: 1,
        },
        restrictionAudits: {
          include: { actor: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        operationalTasks: {
          where: { status: 'OPEN' },
          include: {
            booking: {
              select: {
                id: true,
                code: true,
                status: true,
                checkIn: true,
                checkOut: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: activeBookingStatuses },
                checkOut: { gt: vietnamToday() },
              },
            },
          },
        },
      },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    const gallery =
      (await this.media.listMetadata([id], 'admin')).get(id) ?? [];
    const readiness = hotelSubmissionReadiness(
      hotel,
      gallery,
      hotel.rooms.filter(
        (room) => room.status === RoomStatus.ACTIVE && room.quantity > 0,
      ).length,
    );
    const restoreBlockers = this.restoreBlockers(
      hotel,
      readiness.readyForReview,
    );
    return {
      ...hotel,
      gallery,
      coverImageUrl:
        gallery.find((image) => image.isCover)?.url ?? hotel.coverImageUrl,
      futureBookingCount: hotel._count.bookings,
      evidenceAvailable: false,
      readiness,
      allowedActions: {
        hide: hotel.status === HotelStatus.APPROVED && hotel.isVisible,
        suspend: hotel.status === HotelStatus.APPROVED && hotel.isVisible,
        restore:
          (hotel.status === HotelStatus.SUSPENDED ||
            (hotel.status === HotelStatus.APPROVED && !hotel.isVisible)) &&
          restoreBlockers.length === 0,
      },
      restoreBlockers,
    };
  }

  private restoreBlockers(
    hotel: {
      owner: {
        role: UserRole;
        status: UserStatus;
        isActive: boolean;
        ownerApplication: { status: string } | null;
        ownerProfile: { isActive: boolean } | null;
      };
      submissions: { version: number; status: HotelSubmissionStatus }[];
      profileVersion: number;
    },
    ready: boolean,
  ) {
    const blockers: string[] = [];
    if (
      hotel.owner.role !== UserRole.HOTEL_OWNER ||
      hotel.owner.status !== UserStatus.ACTIVE ||
      !hotel.owner.isActive ||
      hotel.owner.ownerApplication?.status !== 'VERIFIED' ||
      !hotel.owner.ownerProfile?.isActive
    )
      blockers.push('Chủ khách sạn chưa đủ điều kiện hoạt động.');
    if (!ready)
      blockers.push(
        'Hồ sơ khách sạn chưa đủ thông tin, ảnh bìa, chính sách hoặc phòng hoạt động.',
      );
    if (
      hotel.submissions.length &&
      (hotel.submissions[0].status !== HotelSubmissionStatus.APPROVED ||
        hotel.submissions[0].version !== hotel.profileVersion)
    )
      blockers.push('Phiên bản hồ sơ hiện tại chưa được duyệt.');
    return blockers;
  }

  async decide(
    id: string,
    actor: AuthenticatedUser,
    input: AdminHotelDecisionDto,
  ) {
    const reason = input.reason?.trim();
    const evidenceReference = input.evidenceReference?.trim() || null;
    if (!reason || reason.length < 10)
      throw new BadRequestException('Cần nhập lý do tối thiểu 10 ký tự.');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const repeated = await tx.hotelRestrictionAudit.findUnique({
          where: { requestId: input.requestId },
        });
        if (repeated) {
          if (
            repeated.hotelId !== id ||
            repeated.actorId !== actor.id ||
            repeated.action !== input.action ||
            repeated.reason !== reason ||
            repeated.evidenceReference !== evidenceReference ||
            repeated.profileVersion !== input.expectedProfileVersion ||
            repeated.restrictionVersion !== input.expectedRestrictionVersion + 1
          )
            throw new ConflictException(
              'Mã yêu cầu đã được dùng cho quyết định khác.',
            );
          return {
            hotelId: id,
            status: repeated.afterStatus,
            isVisible: repeated.afterVisible,
            restrictionVersion: repeated.restrictionVersion,
            futureBookingCount: repeated.futureBookingCount,
            requestId: input.requestId,
          };
        }
        const hotel = await tx.hotel.findFirst({
          where: { id, deletedAt: null },
          include: {
            owner: {
              select: {
                role: true,
                status: true,
                isActive: true,
                ownerApplication: { select: { status: true } },
                ownerProfile: { select: { isActive: true } },
              },
            },
            policy: true,
            submissions: {
              select: { version: true, status: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
            rooms: {
              where: {
                deletedAt: null,
                status: RoomStatus.ACTIVE,
                quantity: { gt: 0 },
              },
              select: { id: true },
            },
          },
        });
        if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
        if (
          hotel.profileVersion !== input.expectedProfileVersion ||
          hotel.restrictionVersion !== input.expectedRestrictionVersion
        )
          throw new ConflictException({
            code: 'HOTEL_RESTRICTION_VERSION_CONFLICT',
            message: 'Khách sạn đã thay đổi. Hãy tải lại trước khi quyết định.',
          });
        const restricted =
          hotel.status === HotelStatus.SUSPENDED ||
          (hotel.status === HotelStatus.APPROVED && !hotel.isVisible);
        if (
          input.action === 'RESTORE'
            ? !restricted
            : hotel.status !== HotelStatus.APPROVED || !hotel.isVisible
        )
          throw new ConflictException(
            'Trạng thái hiện tại không cho phép quyết định này.',
          );
        if (input.action === 'RESTORE') {
          const coverCount = await tx.hotelMedia.count({
            where: {
              hotelId: id,
              roomId: null,
              status: 'READY',
              isCover: true,
              deletedAt: null,
            },
          });
          const ready = hotelSubmissionReadiness(
            hotel,
            coverCount ? [{ isCover: true }] : [],
            hotel.rooms.length,
          ).readyForReview;
          const blockers = this.restoreBlockers(hotel, ready);
          if (blockers.length)
            throw new ConflictException({
              code: 'HOTEL_RESTORE_BLOCKED',
              message: blockers.join(' '),
              blockers,
            });
        }
        const nextStatus =
          input.action === 'SUSPEND'
            ? HotelStatus.SUSPENDED
            : HotelStatus.APPROVED;
        const nextVisible = input.action === 'RESTORE';
        const updated = await tx.hotel.updateMany({
          where: {
            id,
            profileVersion: hotel.profileVersion,
            restrictionVersion: hotel.restrictionVersion,
            status: hotel.status,
            isVisible: hotel.isVisible,
            deletedAt: null,
          },
          data: {
            status: nextStatus,
            isVisible: nextVisible,
            restrictionVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Khách sạn đã thay đổi. Hãy tải lại.');
        const futureBookings = await tx.booking.findMany({
          where: {
            hotelId: id,
            status: { in: activeBookingStatuses },
            checkOut: { gt: vietnamToday() },
          },
          select: { id: true },
        });
        const audit = await tx.hotelRestrictionAudit.create({
          data: {
            hotelId: id,
            ownerId: hotel.ownerId,
            actorId: actor.id,
            actorRole: UserRole.ADMIN,
            action: input.action,
            beforeStatus: hotel.status,
            afterStatus: nextStatus,
            beforeVisible: hotel.isVisible,
            afterVisible: nextVisible,
            profileVersion: hotel.profileVersion,
            restrictionVersion: hotel.restrictionVersion + 1,
            reason,
            evidenceReference,
            futureBookingCount: futureBookings.length,
            requestId: input.requestId,
          },
        });
        await tx.hotelRestrictionNotification.create({
          data: {
            decisionId: audit.id,
            recipientId: hotel.ownerId,
            title:
              input.action === 'RESTORE'
                ? 'Khách sạn đã được khôi phục'
                : input.action === 'SUSPEND'
                  ? 'Khách sạn bị đình chỉ'
                  : 'Khách sạn tạm ẩn',
            body: `${hotel.name}: ${reason}`,
          },
        });
        if (input.action === 'RESTORE') {
          await tx.hotelBookingOperationalTask.updateMany({
            where: { hotelId: id, status: 'OPEN' },
            data: { status: 'RESOLVED', resolvedAt: new Date() },
          });
        } else if (futureBookings.length) {
          await tx.hotelBookingOperationalTask.createMany({
            data: futureBookings.map((booking) => ({
              decisionId: audit.id,
              hotelId: id,
              bookingId: booking.id,
            })),
          });
        }
        return {
          hotelId: id,
          status: nextStatus,
          isVisible: nextVisible,
          restrictionVersion: hotel.restrictionVersion + 1,
          futureBookingCount: futureBookings.length,
          requestId: input.requestId,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
