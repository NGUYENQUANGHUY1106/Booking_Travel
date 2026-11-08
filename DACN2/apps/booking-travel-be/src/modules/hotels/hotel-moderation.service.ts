import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HotelStatus, HotelSubmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ReviewHotelSubmissionDto } from './dto/review-hotel-submission.dto';
import { HotelReviewQueryDto } from './dto/hotel-review-query.dto';
import { HotelMediaService } from './hotel-media.service';

function snapshotMediaIds(snapshot: Record<string, unknown>) {
  const hotelIds = Array.isArray(snapshot.mediaIds)
    ? snapshot.mediaIds.filter((id): id is string => typeof id === 'string')
    : [];
  const rooms = Array.isArray(snapshot.rooms) ? snapshot.rooms : [];
  const roomIds = rooms.flatMap((room) => {
    if (
      !room ||
      typeof room !== 'object' ||
      !Array.isArray((room as { media?: unknown }).media)
    )
      return [];
    return (room as { media: unknown[] }).media.flatMap((item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string'
        ? [(item as { id: string }).id]
        : [],
    );
  });
  return [...new Set([...hotelIds, ...roomIds])];
}

function missingEvidence(
  snapshot: Record<string, unknown>,
  availableMediaIds: string[],
) {
  const missing: string[] = [];
  const hasText = (key: string) =>
    typeof snapshot[key] === 'string' && Boolean(snapshot[key].trim());
  if (!hasText('name') || !hasText('accommodationType'))
    missing.push('Tên hoặc loại chỗ ở');
  if (
    !hasText('addressLine') ||
    !hasText('provinceUnitId') ||
    !hasText('wardUnitId') ||
    !hasText('latitude') ||
    !hasText('longitude')
  )
    missing.push('Vị trí');
  if (
    (!hasText('contactEmail') && !hasText('contactPhone')) ||
    !hasText('checkInTime') ||
    !hasText('checkOutTime')
  )
    missing.push('Liên hệ và giờ nhận/trả');
  const policy = snapshot.policy as {
    cancellationPolicy?: unknown;
    houseRules?: unknown;
  } | null;
  if (!policy || (!policy.cancellationPolicy && !policy.houseRules))
    missing.push('Chính sách');
  const rooms = Array.isArray(snapshot.rooms) ? snapshot.rooms : [];
  if (!rooms.length) missing.push('Hạng phòng');
  if (
    rooms.some((room) => {
      if (!room || typeof room !== 'object') return true;
      const data = room as Record<string, unknown>;
      return (
        typeof data.name !== 'string' ||
        !data.name.trim() ||
        typeof data.capacityAdults !== 'number' ||
        data.capacityAdults <= 0
      );
    })
  )
    missing.push('Thông tin hạng phòng');
  const checklist = Array.isArray(snapshot.checklist) ? snapshot.checklist : [];
  if (
    !checklist.length ||
    checklist.some(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        (entry as { required?: unknown }).required !== true ||
        (entry as { complete?: unknown }).complete !== true,
    )
  )
    missing.push('Checklist khi gửi duyệt');
  const mediaIds = snapshotMediaIds(snapshot);
  if (!hasText('coverId') || !mediaIds.includes(snapshot.coverId as string))
    missing.push('Ảnh bìa trong bản nộp');
  if (mediaIds.some((id) => !availableMediaIds.includes(id)))
    missing.push('Ảnh của bản nộp không còn khả dụng');
  return missing;
}

@Injectable()
export class HotelModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: HotelMediaService,
  ) {}

  async pending(query: HotelReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const types = [...new Set(query.types?.split(',') ?? [])];
    const search = query.search?.trim().replace(/\s+/g, ' ').normalize('NFKC');
    const typeClause = types.length
      ? Prisma.sql`AND h."accommodationType"::text IN (${Prisma.join(types)})`
      : Prisma.empty;
    const searchClause = search
      ? Prisma.sql`AND (
      POSITION(lower(${search}) IN lower(h."name")) > 0 OR
      POSITION(lower(${search}) IN lower(owner."fullName")) > 0 OR
      POSITION(lower(${search}) IN lower(COALESCE(owner."email", ''))) > 0 OR
      POSITION(lower(${search}) IN lower(hs."id")) > 0
    )`
      : Prisma.empty;
    const where = Prisma.sql`FROM "HotelSubmission" hs
      JOIN "Hotel" h ON h."id" = hs."hotelId"
      JOIN "User" owner ON owner."id" = hs."ownerId"
      WHERE hs."status" = 'PENDING' AND h."status" = 'PENDING'
        AND h."deletedAt" IS NULL AND h."profileVersion" = hs."version"
        ${typeClause} ${searchClause}`;
    const order = query.sort === 'oldest' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const result = await this.prisma.$transaction(
      async (tx) => {
        const counts = await tx.$queryRaw<
          { count: number }[]
        >`SELECT COUNT(*)::int AS count ${where}`;
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT hs."id" ${where} ORDER BY hs."submittedAt" ${order}, hs."id" ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
        const rows = ids.length
          ? await tx.hotelSubmission.findMany({
              where: { id: { in: ids.map((item) => item.id) } },
              include: {
                hotel: {
                  select: {
                    owner: {
                      select: { id: true, fullName: true, email: true },
                    },
                  },
                },
              },
            })
          : [];
        return {
          total: counts[0]?.count ?? 0,
          rows: ids
            .map(({ id }) => rows.find((row) => row.id === id)!)
            .filter(Boolean),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const items = await Promise.all(
      result.rows.map(async (row) => {
        const snapshot = row.snapshot as Record<string, unknown>;
        const coverId =
          typeof snapshot.coverId === 'string' ? snapshot.coverId : undefined;
        const media = coverId
          ? await this.media.submissionMedia(row.hotelId, [coverId])
          : [];
        return {
          id: row.id,
          hotelId: row.hotelId,
          version: row.version,
          status: row.status,
          submittedAt: row.submittedAt,
          name: snapshot.name,
          accommodationType: snapshot.accommodationType,
          address: [
            snapshot.addressLine,
            snapshot.ward,
            snapshot.district,
            snapshot.province,
          ]
            .filter(Boolean)
            .join(', '),
          roomTypeCount: Array.isArray(snapshot.rooms)
            ? snapshot.rooms.length
            : 0,
          coverImageUrl: media[0]?.url ?? null,
          owner: row.hotel.owner,
        };
      }),
    );
    return { items, total: result.total, page, limit };
  }

  async detail(id: string) {
    const row = await this.prisma.hotelSubmission.findUnique({
      where: { id },
      include: {
        hotel: {
          select: {
            name: true,
            status: true,
            deletedAt: true,
            profileVersion: true,
            coverImageUrl: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                ownerApplication: { select: { status: true } },
                ownerProfile: { select: { isActive: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ duyệt.');
    if (
      row.status !== HotelSubmissionStatus.PENDING ||
      row.hotel.status !== HotelStatus.PENDING ||
      row.hotel.deletedAt !== null ||
      row.hotel.profileVersion !== row.version
    )
      throw new ConflictException(
        'Hồ sơ đã được xử lý hoặc thay đổi. Hãy tải lại hàng chờ.',
      );
    const snapshot = row.snapshot as Record<string, unknown>;
    const mediaIds = snapshotMediaIds(snapshot);
    const media = await this.media.submissionMedia(row.hotelId, mediaIds);
    const missing = missingEvidence(
      snapshot,
      media.map((item) => item.id),
    );
    if (
      row.hotel.owner.ownerApplication?.status !== 'VERIFIED' ||
      !row.hotel.owner.ownerProfile?.isActive
    )
      missing.push('Chủ khách sạn chưa được xác minh');
    return {
      id: row.id,
      hotelId: row.hotelId,
      ownerId: row.ownerId,
      version: row.version,
      status: row.status,
      submittedAt: row.submittedAt,
      snapshot,
      hotel: row.hotel,
      media,
      evidence: { canApprove: missing.length === 0, missing },
    };
  }

  async decide(
    id: string,
    actor: AuthenticatedUser,
    input: ReviewHotelSubmissionDto,
  ) {
    const reason = input.reason?.trim();
    const requestId = input.requestId ?? randomUUID();
    if (input.decision === 'REJECT' && (!reason || reason.length < 3))
      throw new BadRequestException({
        code: 'REJECTION_REASON_REQUIRED',
        message: 'Cần nhập lý do từ chối.',
      });
    const result = await this.prisma.$transaction(
      async (tx) => {
        const submission = await tx.hotelSubmission.findUnique({
          where: { id },
          select: {
            id: true,
            hotelId: true,
            ownerId: true,
            version: true,
            status: true,
            snapshot: true,
          },
        });
        if (!submission)
          throw new NotFoundException('Không tìm thấy hồ sơ duyệt.');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${submission.hotelId}))`;
        const repeated = await tx.hotelSubmissionAudit.findUnique({
          where: { requestId },
        });
        if (repeated) {
          if (
            repeated.submissionId !== id ||
            repeated.actorId !== actor.id ||
            repeated.version !== input.expectedVersion ||
            repeated.action !==
              (input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED') ||
            (input.decision === 'REJECT' && repeated.reason !== reason)
          )
            throw new ConflictException(
              'Mã yêu cầu đã được dùng cho quyết định khác.',
            );
          return {
            submissionId: id,
            hotelId: repeated.hotelId,
            status: repeated.newStatus,
            version: repeated.version,
            requestId,
            decidedAt: repeated.createdAt,
          };
        }
        const hotel = await tx.hotel.findUnique({
          where: { id: submission.hotelId },
          select: { status: true, profileVersion: true, deletedAt: true },
        });
        if (
          submission.status !== HotelSubmissionStatus.PENDING ||
          hotel?.status !== HotelStatus.PENDING ||
          hotel.deletedAt ||
          hotel.profileVersion !== submission.version ||
          submission.version !== input.expectedVersion
        )
          throw new ConflictException({
            code: 'HOTEL_SUBMISSION_VERSION_CONFLICT',
            message: 'Hồ sơ đã thay đổi. Hãy tải lại trước khi quyết định.',
          });
        if (input.decision === 'APPROVE') {
          const owner = await tx.user.findUnique({
            where: { id: submission.ownerId },
            select: {
              ownerApplication: { select: { status: true } },
              ownerProfile: { select: { isActive: true } },
            },
          });
          if (
            owner?.ownerApplication?.status !== 'VERIFIED' ||
            !owner.ownerProfile?.isActive
          )
            throw new ConflictException({
              code: 'HOTEL_OWNER_NOT_VERIFIED',
              message:
                'Chủ khách sạn chưa được xác minh hoặc đã bị vô hiệu hóa.',
            });
          const snapshot = submission.snapshot as Record<string, unknown>;
          const ids = snapshotMediaIds(snapshot);
          const available = await tx.hotelMedia.findMany({
            where: {
              id: { in: ids },
              hotelId: submission.hotelId,
              status: 'READY',
              deletedAt: null,
            },
            select: { id: true },
          });
          const missing = missingEvidence(
            snapshot,
            available.map((item) => item.id),
          );
          if (missing.length)
            throw new ConflictException({
              code: 'HOTEL_SUBMISSION_EVIDENCE_MISSING',
              message: 'Bản nộp thiếu bằng chứng. Không thể duyệt.',
              missing,
            });
        }
        const nextStatus =
          input.decision === 'APPROVE'
            ? HotelStatus.APPROVED
            : HotelStatus.REJECTED;
        const updatedHotel = await tx.hotel.updateMany({
          where: {
            id: submission.hotelId,
            status: HotelStatus.PENDING,
            profileVersion: submission.version,
            deletedAt: null,
          },
          data: { status: nextStatus, isVisible: input.decision === 'APPROVE' },
        });
        if (updatedHotel.count !== 1)
          throw new ConflictException('Hồ sơ đã thay đổi.');
        const decidedAt = new Date();
        const updatedSubmission = await tx.hotelSubmission.updateMany({
          where: {
            id,
            status: HotelSubmissionStatus.PENDING,
            version: input.expectedVersion,
          },
          data: {
            status:
              input.decision === 'APPROVE'
                ? HotelSubmissionStatus.APPROVED
                : HotelSubmissionStatus.REJECTED,
            reason: input.decision === 'REJECT' ? reason : null,
            decidedById: actor.id,
            decidedAt,
          },
        });
        if (updatedSubmission.count !== 1)
          throw new ConflictException('Hồ sơ đã được xử lý.');
        await tx.hotelSubmissionAudit.create({
          data: {
            submissionId: id,
            actorId: actor.id,
            action: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            oldStatus: HotelStatus.PENDING,
            newStatus: nextStatus,
            hotelId: submission.hotelId,
            version: submission.version,
            reason: input.decision === 'REJECT' ? reason : null,
            requestId,
            createdAt: decidedAt,
          },
        });
        await tx.hotelSubmissionNotification.create({
          data: {
            submissionId: id,
            recipientId: submission.ownerId,
            kind: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            title:
              input.decision === 'APPROVE'
                ? 'Khách sạn đã được duyệt'
                : 'Khách sạn cần chỉnh sửa',
            body:
              input.decision === 'APPROVE'
                ? 'Hồ sơ khách sạn của bạn đã được duyệt.'
                : `Hồ sơ khách sạn bị từ chối: ${reason}`,
          },
        });
        return {
          submissionId: id,
          hotelId: submission.hotelId,
          status: nextStatus,
          version: submission.version,
          requestId,
          decidedAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return result;
  }
}
