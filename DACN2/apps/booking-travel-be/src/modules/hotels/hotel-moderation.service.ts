import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, HotelSubmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ReviewHotelSubmissionDto } from './dto/review-hotel-submission.dto';
import { HotelMediaService } from './hotel-media.service';

@Injectable()
export class HotelModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: HotelMediaService,
  ) {}

  async pending() {
    const rows = await this.prisma.hotelSubmission.findMany({
      where: {
        status: HotelSubmissionStatus.PENDING,
        hotel: { status: HotelStatus.PENDING, deletedAt: null },
      },
      include: {
        hotel: {
          select: {
            name: true,
            profileVersion: true,
            accommodationType: true,
            coverImageUrl: true,
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return rows.filter((row) => row.version === row.hotel.profileVersion);
  }

  async detail(id: string) {
    const row = await this.prisma.hotelSubmission.findUnique({
      where: { id },
      include: {
        hotel: {
          select: {
            name: true,
            status: true,
            profileVersion: true,
            coverImageUrl: true,
            owner: { select: { id: true, fullName: true, email: true } },
          },
        },
        audits: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ duyệt.');
    const snapshot = row.snapshot as Record<string, unknown>;
    const mediaIds = [
      ...((snapshot.mediaIds as string[] | undefined) ?? []),
      ...(
        (snapshot.rooms as { media?: { id: string }[] }[] | undefined) ?? []
      ).flatMap((room) => (room.media ?? []).map((item) => item.id)),
    ];
    const media = await this.media.submissionMedia(row.hotelId, mediaIds);
    return { ...row, media };
  }

  async decide(
    id: string,
    actor: AuthenticatedUser,
    input: ReviewHotelSubmissionDto,
  ) {
    const reason = input.reason?.trim();
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
          },
        });
        if (!submission)
          throw new NotFoundException('Không tìm thấy hồ sơ duyệt.');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${submission.hotelId}))`;
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
            decidedAt: new Date(),
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
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return result;
  }
}
