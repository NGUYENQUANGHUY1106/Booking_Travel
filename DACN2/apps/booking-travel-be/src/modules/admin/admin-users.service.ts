import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

export type AccountAction = 'LOCK' | 'UNLOCK' | 'SUSPEND' | 'RESTORE';

const ACCOUNT_TRANSITIONS: Record<
  AccountAction,
  { from: UserStatus; to: UserStatus }
> = {
  LOCK: { from: UserStatus.ACTIVE, to: UserStatus.LOCKED },
  UNLOCK: { from: UserStatus.LOCKED, to: UserStatus.ACTIVE },
  SUSPEND: { from: UserStatus.ACTIVE, to: UserStatus.SUSPENDED },
  RESTORE: { from: UserStatus.SUSPENDED, to: UserStatus.ACTIVE },
};
const MANAGED_ROLES: UserRole[] = [UserRole.USER, UserRole.HOTEL_OWNER];

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertActor(actor: AuthenticatedUser) {
    if (
      actor.role !== UserRole.ADMIN ||
      !actor.permissions.includes('USER_MANAGEMENT')
    ) {
      throw new ForbiddenException('Bạn không có quyền quản lý người dùng.');
    }
  }

  private assertId(id: string) {
    if (!/^[a-z0-9_-]{8,64}$/i.test(id)) {
      throw new BadRequestException('Mã người dùng không hợp lệ.');
    }
  }

  async list(query: AdminUserQueryDto, actor: AuthenticatedUser) {
    this.assertActor(actor);
    if (query.role && !MANAGED_ROLES.includes(query.role)) {
      throw new BadRequestException('Vai trò lọc không hợp lệ.');
    }

    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role ?? { in: MANAGED_ROLES },
      status: query.status,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const orderBy = [
      { [query.sortBy]: query.sortOrder },
      { id: 'asc' },
    ] as Prisma.UserOrderByWithRelationInput[];
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          authSessions: {
            orderBy: { lastUsedAt: 'desc' },
            take: 1,
            select: { lastUsedAt: true },
          },
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: items.map(({ authSessions, ...user }) => ({
        ...user,
        lastSessionAt: authSessions[0]?.lastUsedAt ?? null,
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async get(id: string, actor: AuthenticatedUser) {
    this.assertActor(actor);
    this.assertId(id);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        _count: { select: { bookings: true, ownedHotels: true } },
      },
    });
    if (!user || !MANAGED_ROLES.includes(user.role)) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    const [lastSession, audit] = await Promise.all([
      this.prisma.authSession.findFirst({
        where: { userId: id },
        orderBy: { lastUsedAt: 'desc' },
        select: { lastUsedAt: true },
      }),
      this.prisma.adminUserAudit.findMany({
        where: { targetUserId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          oldStatus: true,
          newStatus: true,
          reason: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    return {
      ...user,
      lastSessionAt: lastSession?.lastUsedAt ?? null,
      activitySummary: {
        bookingCount: user._count.bookings,
        accommodationCount: user._count.ownedHotels,
        lastSessionAt: lastSession?.lastUsedAt ?? null,
      },
      audit,
    };
  }

  async changeStatus(
    id: string,
    action: AccountAction,
    reason: string,
    actor: AuthenticatedUser,
  ) {
    this.assertActor(actor);
    this.assertId(id);
    const normalizedReason = reason?.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      throw new BadRequestException('Lý do phải có từ 1 đến 500 ký tự.');
    }
    if (id === actor.id) {
      throw new ForbiddenException(
        'Không được thay đổi trạng thái tài khoản đang sử dụng.',
      );
    }

    const transition = ACCOUNT_TRANSITIONS[action];
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const target = await transaction.user.findUnique({
            where: { id },
            select: { id: true, role: true, status: true },
          });
          if (!target)
            throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
          if (!MANAGED_ROLES.includes(target.role)) {
            throw new ForbiddenException(
              'Không được thay đổi trạng thái tài khoản Admin.',
            );
          }
          if (target.status !== transition.from) {
            throw new ConflictException(
              'Trạng thái tài khoản đã thay đổi hoặc không cho phép thao tác này.',
            );
          }

          const changed = await transaction.user.updateMany({
            where: { id, status: transition.from },
            data: {
              status: transition.to,
              isActive: transition.to === UserStatus.ACTIVE,
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException(
              'Tài khoản đã được cập nhật bởi yêu cầu khác. Vui lòng tải lại.',
            );
          }

          if (action === 'LOCK' || action === 'SUSPEND') {
            await transaction.authSession.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }

          const audit = await transaction.adminUserAudit.create({
            data: {
              actorId: actor.id,
              targetUserId: id,
              action,
              oldStatus: transition.from,
              newStatus: transition.to,
              reason: normalizedReason,
            },
            select: { id: true, createdAt: true },
          });

          return {
            id,
            status: transition.to,
            auditId: audit.id,
            updatedAt: audit.createdAt,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Tài khoản đang được cập nhật. Vui lòng tải lại và thử lần nữa.',
        );
      }
      throw error;
    }
  }
}
