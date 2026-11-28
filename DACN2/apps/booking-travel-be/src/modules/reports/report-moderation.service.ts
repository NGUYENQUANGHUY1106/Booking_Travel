import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentReportReason,
  HotelReportReason,
  HotelReportStatus,
  Prisma,
  ReportTargetType,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AdminHotelManagementService } from '../hotels/admin-hotel-management.service';
import type {
  ReportDecisionDto,
  ReportQueueDto,
  RestoreContentDto,
} from './dto/admin-report.dto';

type Kind = ReportTargetType;
type ReportViewRow = {
  id: string;
  reason: string;
  category?: string;
  description: string | null;
  status: HotelReportStatus;
  createdAt: Date;
  updatedAt?: Date;
  assigneeId: string | null;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  resolution: string | null;
  reporter: { id: string; fullName: string; email?: string | null };
  hotel?: { id: string; name: string; isVisible?: boolean };
  review?: {
    id: string;
    isVisible: boolean;
    content?: string;
    rating?: number;
    hotel: { name: string };
  };
  reply?: {
    id: string;
    isVisible: boolean;
    content?: string;
    review: { hotel: { name: string } };
  };
  evidenceUrls?: string[];
  booking?: unknown;
};

@Injectable()
export class ReportModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotels: AdminHotelManagementService,
  ) {}

  private normalize(kind: Kind, row: ReportViewRow) {
    const target =
      kind === 'HOTEL' ? row.hotel : kind === 'REVIEW' ? row.review : row.reply;
    const hotel =
      kind === 'HOTEL'
        ? row.hotel
        : kind === 'REVIEW'
          ? row.review?.hotel
          : row.reply?.review?.hotel;
    return {
      id: row.id,
      targetType: kind,
      targetId: target?.id ?? null,
      targetName: hotel?.name ?? 'Nội dung không còn tồn tại',
      reason: kind === 'REPLY' ? row.category : row.reason,
      description: row.description ?? (kind === 'REPLY' ? row.reason : ''),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? row.createdAt,
      assigneeId: row.assigneeId,
      claimedAt: row.claimedAt,
      resolvedAt: row.resolvedAt,
      resolution: row.resolution,
      reporter: row.reporter,
      target,
      evidenceUrls: kind === 'HOTEL' ? (row.evidenceUrls ?? []) : [],
      booking: kind === 'HOTEL' ? row.booking : undefined,
    };
  }

  async list(query: ReportQueueDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const take = page * limit;
    const search = query.search?.trim();
    const reason = query.reason?.trim();
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo!))
      dateTo.setUTCHours(23, 59, 59, 999);
    if (dateFrom && dateTo && dateFrom > dateTo)
      throw new BadRequestException('Khoảng thời gian báo cáo không hợp lệ.');
    if (
      reason &&
      !Object.values(HotelReportReason).includes(reason as HotelReportReason) &&
      !Object.values(ContentReportReason).includes(
        reason as ContentReportReason,
      )
    )
      throw new BadRequestException('Lý do báo cáo không hợp lệ.');
    const common = {
      status: query.status,
      assigneeId: query.assigneeId,
      createdAt:
        dateFrom || dateTo ? { gte: dateFrom, lte: dateTo } : undefined,
    };
    const hotels: Prisma.HotelReportWhereInput = {
      ...common,
      ...(reason
        ? Object.values(HotelReportReason).includes(reason as HotelReportReason)
          ? { reason: reason as HotelReportReason }
          : { id: '__no_match__' }
        : {}),
      ...(search
        ? {
            OR: [
              { hotel: { name: { contains: search, mode: 'insensitive' } } },
              {
                reporter: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              { id: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const reviews: Prisma.ReviewReportWhereInput = {
      ...common,
      ...(reason
        ? Object.values(ContentReportReason).includes(
            reason as ContentReportReason,
          )
          ? { reason: reason as ContentReportReason }
          : { id: '__no_match__' }
        : {}),
      ...(search
        ? {
            OR: [
              {
                review: {
                  hotel: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                reporter: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              { id: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const replies: Prisma.ReviewReplyReportWhereInput = {
      ...common,
      ...(reason
        ? Object.values(ContentReportReason).includes(
            reason as ContentReportReason,
          )
          ? { category: reason as ContentReportReason }
          : { id: '__no_match__' }
        : {}),
      ...(search
        ? {
            OR: [
              {
                reply: {
                  review: {
                    hotel: { name: { contains: search, mode: 'insensitive' } },
                  },
                },
              },
              {
                reporter: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              { id: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const enabled = (kind: Kind) =>
      !query.targetType || query.targetType === kind;
    const [
      hotelRows,
      reviewRows,
      replyRows,
      hotelCount,
      reviewCount,
      replyCount,
    ] = await Promise.all([
      enabled('HOTEL')
        ? this.prisma.hotelReport.findMany({
            where: hotels,
            include: {
              hotel: { select: { id: true, name: true } },
              reporter: { select: { id: true, fullName: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take,
          })
        : [],
      enabled('REVIEW')
        ? this.prisma.reviewReport.findMany({
            where: reviews,
            include: {
              review: {
                select: {
                  id: true,
                  isVisible: true,
                  hotel: { select: { name: true } },
                },
              },
              reporter: { select: { id: true, fullName: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take,
          })
        : [],
      enabled('REPLY')
        ? this.prisma.reviewReplyReport.findMany({
            where: replies,
            include: {
              reply: {
                select: {
                  id: true,
                  isVisible: true,
                  review: { select: { hotel: { select: { name: true } } } },
                },
              },
              reporter: { select: { id: true, fullName: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take,
          })
        : [],
      enabled('HOTEL') ? this.prisma.hotelReport.count({ where: hotels }) : 0,
      enabled('REVIEW')
        ? this.prisma.reviewReport.count({ where: reviews })
        : 0,
      enabled('REPLY')
        ? this.prisma.reviewReplyReport.count({ where: replies })
        : 0,
    ]);
    const items = [
      ...hotelRows.map((row) => this.normalize('HOTEL', row)),
      ...reviewRows.map((row) => this.normalize('REVIEW', row)),
      ...replyRows.map((row) => this.normalize('REPLY', row)),
    ].sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    );
    return {
      items: items.slice((page - 1) * limit, page * limit),
      total: hotelCount + reviewCount + replyCount,
      page,
      limit,
    };
  }

  async detail(kind: Kind, id: string) {
    const row =
      kind === 'HOTEL'
        ? await this.prisma.hotelReport.findUnique({
            where: { id },
            include: {
              hotel: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  isVisible: true,
                  restrictionVersion: true,
                  profileVersion: true,
                },
              },
              booking: { select: { id: true, code: true, status: true } },
              reporter: { select: { id: true, fullName: true, email: true } },
            },
          })
        : kind === 'REVIEW'
          ? await this.prisma.reviewReport.findUnique({
              where: { id },
              include: {
                review: {
                  select: {
                    id: true,
                    content: true,
                    title: true,
                    rating: true,
                    isVisible: true,
                    authorId: true,
                    hotel: { select: { id: true, name: true } },
                  },
                },
                reporter: { select: { id: true, fullName: true, email: true } },
              },
            })
          : await this.prisma.reviewReplyReport.findUnique({
              where: { id },
              include: {
                reply: {
                  select: {
                    id: true,
                    content: true,
                    isVisible: true,
                    authorId: true,
                    review: {
                      select: {
                        id: true,
                        isVisible: true,
                        hotel: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
                reporter: { select: { id: true, fullName: true, email: true } },
              },
            });
    if (!row) throw new NotFoundException('Không tìm thấy báo cáo.');
    const normalized = this.normalize(kind, row);
    const [related, actions] = await Promise.all([
      kind === 'HOTEL'
        ? this.prisma.hotelReport.findMany({
            where: { hotelId: normalized.targetId!, id: { not: id } },
            select: { id: true, status: true, createdAt: true },
            take: 20,
            orderBy: { createdAt: 'desc' },
          })
        : kind === 'REVIEW'
          ? this.prisma.reviewReport.findMany({
              where: { reviewId: normalized.targetId!, id: { not: id } },
              select: { id: true, status: true, createdAt: true },
              take: 20,
              orderBy: { createdAt: 'desc' },
            })
          : this.prisma.reviewReplyReport.findMany({
              where: { replyId: normalized.targetId!, id: { not: id } },
              select: { id: true, status: true, createdAt: true },
              take: 20,
              orderBy: { createdAt: 'desc' },
            }),
      this.prisma.reportModerationAction.findMany({
        where: {
          targetType: kind,
          OR: [{ reportId: id }, { targetId: normalized.targetId! }],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    return { ...normalized, related, actions };
  }

  async claim(kind: Kind, id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${id}`}))`;
      const row = await this.findRow(tx, kind, id);
      if (!row) throw new NotFoundException('Không tìm thấy báo cáo.');
      if (
        row.status === HotelReportStatus.IN_REVIEW &&
        row.assigneeId === actorId
      )
        return { id, status: row.status, assigneeId: actorId };
      if (row.status !== HotelReportStatus.OPEN)
        throw new ConflictException(
          'Báo cáo đã được nhận hoặc đã có quyết định.',
        );
      const data = {
        status: HotelReportStatus.IN_REVIEW,
        assigneeId: actorId,
        claimedAt: new Date(),
      };
      if (kind === 'HOTEL')
        await tx.hotelReport.update({ where: { id }, data });
      else if (kind === 'REVIEW')
        await tx.reviewReport.update({ where: { id }, data });
      else await tx.reviewReplyReport.update({ where: { id }, data });
      await tx.reportModerationAction.create({
        data: {
          targetType: kind,
          reportId: id,
          targetId: this.targetId(kind, row),
          actorId,
          action: 'CLAIM',
          reason: 'Nhận xử lý báo cáo',
          beforeState: row.status,
          afterState: HotelReportStatus.IN_REVIEW,
          requestId: `claim:${kind}:${id}`,
        },
      });
      return { id, status: HotelReportStatus.IN_REVIEW, assigneeId: actorId };
    });
  }

  private async findRow(tx: Prisma.TransactionClient, kind: Kind, id: string) {
    if (kind === 'HOTEL') return tx.hotelReport.findUnique({ where: { id } });
    if (kind === 'REVIEW') return tx.reviewReport.findUnique({ where: { id } });
    return tx.reviewReplyReport.findUnique({ where: { id } });
  }

  private targetId(
    kind: Kind,
    row: { hotelId?: string; reviewId?: string; replyId?: string },
  ): string {
    const targetId =
      kind === 'HOTEL'
        ? row.hotelId
        : kind === 'REVIEW'
          ? row.reviewId
          : row.replyId;
    if (!targetId)
      throw new NotFoundException('Nội dung gốc không còn tồn tại.');
    return targetId;
  }

  private async close(
    tx: Prisma.TransactionClient,
    kind: Kind,
    id: string,
    status: HotelReportStatus,
    reason: string,
  ) {
    const data = { status, resolution: reason, resolvedAt: new Date() };
    const where = { id, status: HotelReportStatus.IN_REVIEW };
    const result =
      kind === 'HOTEL'
        ? await tx.hotelReport.updateMany({ where, data })
        : kind === 'REVIEW'
          ? await tx.reviewReport.updateMany({ where, data })
          : await tx.reviewReplyReport.updateMany({ where, data });
    if (result.count !== 1)
      throw new ConflictException('Báo cáo đã được xử lý. Hãy tải lại.');
  }

  async decide(
    kind: Kind,
    id: string,
    actor: AuthenticatedUser,
    input: ReportDecisionDto,
  ) {
    const reason = input.reason.trim();
    if (reason.length < 10)
      throw new BadRequestException('Lý do cần ít nhất 10 ký tự.');
    const valid =
      kind === 'HOTEL'
        ? ['DISMISS', 'ALREADY_HANDLED', 'HIDE_HOTEL', 'SUSPEND_HOTEL']
        : ['HIDE', 'DISMISS', 'ALREADY_HANDLED'];
    if (!valid.includes(input.action))
      throw new BadRequestException(
        'Biện pháp không phù hợp với nội dung bị báo cáo.',
      );
    const existing = await this.prisma.reportModerationAction.findUnique({
      where: { requestId: input.requestId },
    });
    if (existing) {
      if (
        existing.reportId !== id ||
        existing.targetType !== kind ||
        existing.action !== input.action ||
        existing.actorId !== actor.id ||
        existing.reason !== reason
      )
        throw new ConflictException('Mã yêu cầu đã dùng cho quyết định khác.');
      return { id, status: existing.afterState, action: existing.action };
    }
    if (
      kind === 'HOTEL' &&
      (input.action === 'HIDE_HOTEL' || input.action === 'SUSPEND_HOTEL')
    ) {
      const report = await this.prisma.hotelReport.findUnique({
        where: { id },
      });
      if (!report) throw new NotFoundException('Không tìm thấy báo cáo.');
      if (
        report.status !== HotelReportStatus.IN_REVIEW ||
        report.assigneeId !== actor.id
      )
        throw new ConflictException(
          'Hãy nhận xử lý báo cáo trước khi quyết định.',
        );
      const hotel = await this.hotels.detail(report.hotelId);
      await this.hotels.decide(
        report.hotelId,
        actor,
        {
          action: input.action === 'HIDE_HOTEL' ? 'HIDE' : 'SUSPEND',
          reason,
          evidenceReference: `Report ${id}`,
          expectedProfileVersion: hotel.profileVersion,
          expectedRestrictionVersion: hotel.restrictionVersion,
          requestId: input.requestId,
        },
        async (tx, beforeState) => {
          await this.close(tx, kind, id, HotelReportStatus.RESOLVED, reason);
          await tx.reportModerationAction.create({
            data: {
              targetType: kind,
              reportId: id,
              targetId: report.hotelId,
              actorId: actor.id,
              action: input.action,
              reason,
              beforeState,
              afterState: HotelReportStatus.RESOLVED,
              requestId: input.requestId,
            },
          });
        },
      );
      await this.notify(report.reporterId, id, 'RESOLVED');
      return { id, status: HotelReportStatus.RESOLVED, action: input.action };
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${id}`}))`;
      const row = await this.findRow(tx, kind, id);
      if (!row) throw new NotFoundException('Không tìm thấy báo cáo.');
      const repeated = await tx.reportModerationAction.findUnique({
        where: { requestId: input.requestId },
      });
      if (repeated) {
        if (
          repeated.reportId !== id ||
          repeated.targetType !== kind ||
          repeated.action !== input.action ||
          repeated.actorId !== actor.id ||
          repeated.reason !== reason
        )
          throw new ConflictException(
            'Mã yêu cầu đã dùng cho quyết định khác.',
          );
        return {
          id,
          status: repeated.afterState,
          action: repeated.action,
          reporterId: row.reporterId,
          repeated: true,
        };
      }
      if (
        row.status !== HotelReportStatus.IN_REVIEW ||
        row.assigneeId !== actor.id
      )
        throw new ConflictException(
          'Báo cáo chưa được bạn nhận xử lý hoặc đã có quyết định.',
        );
      const targetId = this.targetId(kind, row);
      let beforeState = row.status as string;
      if (input.action === 'HIDE') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${targetId}`}))`;
        if (kind === 'REVIEW') {
          const changed = await tx.review.updateMany({
            where: { id: targetId, isVisible: true },
            data: { isVisible: false },
          });
          if (!changed.count)
            throw new ConflictException(
              'Đánh giá đã bị ẩn hoặc không còn tồn tại.',
            );
          beforeState = 'VISIBLE';
          await tx.reviewActionAudit.create({
            data: {
              reviewId: targetId,
              actorId: actor.id,
              action: 'REVIEW_HIDE',
            },
          });
        } else {
          const changed = await tx.reviewReply.updateMany({
            where: { id: targetId, isVisible: true },
            data: { isVisible: false },
          });
          if (!changed.count)
            throw new ConflictException(
              'Phản hồi đã bị ẩn hoặc không còn tồn tại.',
            );
          beforeState = 'VISIBLE';
          const reply = await tx.reviewReply.findUniqueOrThrow({
            where: { id: targetId },
            select: { reviewId: true },
          });
          await tx.reviewActionAudit.create({
            data: {
              reviewId: reply.reviewId,
              actorId: actor.id,
              action: 'REPLY_HIDE',
            },
          });
        }
      }
      if (input.action === 'ALREADY_HANDLED') {
        const visible =
          kind === 'HOTEL'
            ? (
                await tx.hotel.findUnique({
                  where: { id: targetId },
                  select: { isVisible: true },
                })
              )?.isVisible
            : kind === 'REVIEW'
              ? (
                  await tx.review.findUnique({
                    where: { id: targetId },
                    select: { isVisible: true },
                  })
                )?.isVisible
              : (
                  await tx.reviewReply.findUnique({
                    where: { id: targetId },
                    select: { isVisible: true },
                  })
                )?.isVisible;
        if (visible !== false)
          throw new ConflictException(
            'Nội dung chưa có biện pháp xử lý trước đó.',
          );
      }
      const status =
        input.action === 'DISMISS'
          ? HotelReportStatus.REJECTED
          : HotelReportStatus.RESOLVED;
      await this.close(tx, kind, id, status, reason);
      await tx.reportModerationAction.create({
        data: {
          targetType: kind,
          reportId: id,
          targetId,
          actorId: actor.id,
          action: input.action,
          reason,
          beforeState,
          afterState: status,
          requestId: input.requestId,
        },
      });
      return {
        id,
        status,
        action: input.action,
        reporterId: row.reporterId,
        targetId,
      };
    });
    if (!('repeated' in result)) {
      await this.notify(result.reporterId, id, result.status);
      if (result.action === 'HIDE')
        await this.notifyContentAuthor(kind, result.targetId, id);
    }
    return { id: result.id, status: result.status, action: result.action };
  }

  async restore(
    kind: 'REVIEW' | 'REPLY',
    targetId: string,
    actorId: string,
    input: RestoreContentDto,
  ) {
    const reason = input.reason.trim();
    if (reason.length < 10)
      throw new BadRequestException('Lý do cần ít nhất 10 ký tự.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${targetId}`}))`;
      const repeated = await tx.reportModerationAction.findUnique({
        where: { requestId: input.requestId },
      });
      if (repeated) {
        if (
          repeated.targetType !== kind ||
          repeated.targetId !== targetId ||
          repeated.actorId !== actorId ||
          repeated.reason !== reason ||
          repeated.action !== 'RESTORE'
        )
          throw new ConflictException('Mã yêu cầu đã dùng cho thao tác khác.');
        return { targetId, isVisible: true };
      }
      const changed =
        kind === 'REVIEW'
          ? await tx.review.updateMany({
              where: { id: targetId, isVisible: false },
              data: { isVisible: true },
            })
          : await tx.reviewReply.updateMany({
              where: { id: targetId, isVisible: false },
              data: { isVisible: true },
            });
      if (!changed.count)
        throw new ConflictException('Nội dung không còn ở trạng thái ẩn.');
      const reviewId =
        kind === 'REVIEW'
          ? targetId
          : (
              await tx.reviewReply.findUniqueOrThrow({
                where: { id: targetId },
                select: { reviewId: true },
              })
            ).reviewId;
      await tx.reviewActionAudit.create({
        data: {
          reviewId,
          actorId,
          action: kind === 'REVIEW' ? 'REVIEW_SHOW' : 'REPLY_SHOW',
        },
      });
      await tx.reportModerationAction.create({
        data: {
          targetType: kind,
          reportId: '',
          targetId,
          actorId,
          action: 'RESTORE',
          reason,
          beforeState: 'HIDDEN',
          afterState: 'VISIBLE',
          requestId: input.requestId,
        },
      });
      return { targetId, isVisible: true };
    });
  }

  private async notify(userId: string, reportId: string, status: string) {
    try {
      await this.prisma.userNotification.create({
        data: {
          userId,
          type: 'REPORT_DECISION',
          title: 'Báo cáo đã được xử lý',
          body:
            status === 'RESOLVED'
              ? 'Admin đã xác nhận và xử lý báo cáo của bạn.'
              : 'Admin đã xem xét và bác bỏ báo cáo của bạn.',
          data: { reportId, status },
        },
      });
    } catch {
      /* Notification failure never repeats a committed decision. */
    }
  }

  private async notifyContentAuthor(
    kind: Kind,
    targetId: string,
    reportId: string,
  ) {
    try {
      const authorId =
        kind === 'REVIEW'
          ? (
              await this.prisma.review.findUnique({
                where: { id: targetId },
                select: { authorId: true },
              })
            )?.authorId
          : (
              await this.prisma.reviewReply.findUnique({
                where: { id: targetId },
                select: { authorId: true },
              })
            )?.authorId;
      if (authorId)
        await this.prisma.userNotification.create({
          data: {
            userId: authorId,
            type: 'CONTENT_MODERATED',
            title: 'Nội dung đã được kiểm duyệt',
            body: 'Admin đã ẩn nội dung sau khi xem xét báo cáo.',
            data: { reportId, targetId, targetType: kind },
          },
        });
    } catch {
      /* A notification failure cannot repeat committed moderation. */
    }
  }
}
