import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OwnerApplicationStatus,
  Prisma,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PrivateMediaService } from '../../infrastructure/storage/private-media.service';
import { AdminOwnerApplicationQueryDto } from './dto/admin-owner-application-query.dto';
import { OwnerDecisionDto } from './dto/owner-decision.dto';

const REVIEW_STATUSES = [
  OwnerApplicationStatus.PENDING,
  OwnerApplicationStatus.VERIFIED,
  OwnerApplicationStatus.REJECTED,
  OwnerApplicationStatus.SUSPENDED,
];

@Injectable()
export class OwnerVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: PrivateMediaService,
  ) {}

  private assertAdmin(actor: AuthenticatedUser) {
    if (
      actor.role !== UserRole.ADMIN ||
      !actor.permissions.includes('HOTEL_REVIEW')
    )
      throw new ForbiddenException(
        'Bạn không có quyền xét duyệt hồ sơ Chủ khách sạn.',
      );
  }

  private assertId(id: string) {
    if (!/^[a-z0-9_-]{8,64}$/i.test(id))
      throw new BadRequestException('Mã hồ sơ không hợp lệ.');
  }

  async list(query: AdminOwnerApplicationQueryDto, actor: AuthenticatedUser) {
    this.assertAdmin(actor);
    const search = query.search?.trim();
    const where: Prisma.HotelOwnerApplicationWhereInput = {
      status: query.status ?? { in: REVIEW_STATUSES },
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { businessName: { contains: search, mode: 'insensitive' } },
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    const orderBy = [
      { [query.sortBy]: query.sortOrder },
      { id: 'asc' },
    ] as Prisma.HotelOwnerApplicationOrderByWithRelationInput[];
    const [total, items, pending, verified, rejected, suspended] =
      await Promise.all([
        this.prisma.hotelOwnerApplication.count({ where }),
        this.prisma.hotelOwnerApplication.findMany({
          where,
          select: {
            id: true,
            status: true,
            version: true,
            businessName: true,
            submittedAt: true,
            updatedAt: true,
            user: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        ...[
          OwnerApplicationStatus.PENDING,
          OwnerApplicationStatus.VERIFIED,
          OwnerApplicationStatus.REJECTED,
          OwnerApplicationStatus.SUSPENDED,
        ].map((status) =>
          this.prisma.hotelOwnerApplication.count({ where: { status } }),
        ),
      ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
      summary: { pending, verified, rejected, suspended },
    };
  }

  async detail(id: string, actor: AuthenticatedUser) {
    this.assertAdmin(actor);
    this.assertId(id);
    const application = await this.prisma.hotelOwnerApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        version: true,
        revision: true,
        businessName: true,
        businessAddress: true,
        representativeName: true,
        businessRegistrationNumber: true,
        businessPhone: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        approvalNote: true,
        rejectionReason: true,
        reviewedBy: { select: { id: true, fullName: true } },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
          },
        },
        identityDocument: {
          select: {
            id: true,
            purpose: true,
            status: true,
            mimeType: true,
            expectedSize: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        businessLicenseDocument: {
          select: {
            id: true,
            purpose: true,
            status: true,
            mimeType: true,
            expectedSize: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        auditTrail: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            action: true,
            oldStatus: true,
            newStatus: true,
            reason: true,
            version: true,
            createdAt: true,
            actor: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!application || application.status === OwnerApplicationStatus.DRAFT)
      throw new NotFoundException('Không tìm thấy hồ sơ đã nộp.');
    return application;
  }

  async decide(id: string, input: OwnerDecisionDto, actor: AuthenticatedUser) {
    this.assertAdmin(actor);
    this.assertId(id);
    const reason = input.reason?.trim() || null;
    if (input.decision === 'REJECT' && !reason)
      throw new BadRequestException('Vui lòng nhập lý do từ chối.');

    const snapshot = await this.prisma.hotelOwnerApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        version: true,
        identityDocumentId: true,
        businessLicenseDocumentId: true,
      },
    });
    if (!snapshot) throw new NotFoundException('Không tìm thấy hồ sơ.');
    if (
      snapshot.status !== OwnerApplicationStatus.PENDING ||
      snapshot.version !== input.expectedVersion
    )
      throw new ConflictException(
        'Hồ sơ đã thay đổi hoặc đã được xử lý. Vui lòng tải lại.',
      );

    if (input.decision === 'APPROVE') {
      if (!snapshot.identityDocumentId || !snapshot.businessLicenseDocumentId)
        throw new ConflictException('Hồ sơ thiếu giấy tờ xác minh bắt buộc.');
      await this.media.assertReviewableDocuments(
        snapshot.userId,
        snapshot.identityDocumentId,
        snapshot.businessLicenseDocumentId,
      );
    }

    const now = new Date();
    const nextStatus =
      input.decision === 'APPROVE'
        ? OwnerApplicationStatus.VERIFIED
        : OwnerApplicationStatus.REJECTED;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const application = await tx.hotelOwnerApplication.findUnique({
            where: { id },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                  status: true,
                  isActive: true,
                  emailVerifiedAt: true,
                  phoneVerifiedAt: true,
                },
              },
              identityDocument: {
                select: {
                  id: true,
                  userId: true,
                  status: true,
                  verifiedAt: true,
                },
              },
              businessLicenseDocument: {
                select: {
                  id: true,
                  userId: true,
                  status: true,
                  verifiedAt: true,
                },
              },
            },
          });
          if (
            !application ||
            application.status !== OwnerApplicationStatus.PENDING ||
            application.version !== input.expectedVersion
          )
            throw new ConflictException(
              'Hồ sơ đã được cập nhật bởi quản trị viên khác. Vui lòng tải lại.',
            );
          if (
            application.identityDocumentId !== snapshot.identityDocumentId ||
            application.businessLicenseDocumentId !==
              snapshot.businessLicenseDocumentId
          )
            throw new ConflictException(
              'Tài liệu hồ sơ đã thay đổi. Vui lòng tải lại.',
            );
          if (application.user.role !== UserRole.USER)
            throw new ConflictException(
              'Vai trò người đăng ký đã thay đổi. Vui lòng tải lại.',
            );
          if (input.decision === 'APPROVE') {
            if (
              !application.businessName?.trim() ||
              !application.businessAddress?.trim() ||
              !application.user.fullName.trim() ||
              !application.user.isActive ||
              application.user.status !== UserStatus.ACTIVE ||
              (!application.user.emailVerifiedAt &&
                !application.user.phoneVerifiedAt) ||
              !application.identityDocument?.verifiedAt ||
              !application.businessLicenseDocument?.verifiedAt ||
              application.identityDocument.status !==
                PrivateMediaStatus.READY ||
              application.businessLicenseDocument.status !==
                PrivateMediaStatus.READY ||
              application.identityDocument.userId !== application.userId ||
              application.businessLicenseDocument.userId !== application.userId
            )
              throw new ConflictException(
                'Hồ sơ hoặc tài khoản không còn đủ điều kiện phê duyệt.',
              );
          }

          const changed = await tx.hotelOwnerApplication.updateMany({
            where: {
              id,
              status: OwnerApplicationStatus.PENDING,
              version: input.expectedVersion,
              revision: application.revision,
            },
            data: {
              status: nextStatus,
              revision: { increment: 1 },
              reviewedAt: now,
              reviewedById: actor.id,
              rejectionReason: input.decision === 'REJECT' ? reason : null,
              approvalNote: input.decision === 'APPROVE' ? reason : null,
            },
          });
          if (changed.count !== 1)
            throw new ConflictException('Hồ sơ đã thay đổi. Vui lòng tải lại.');

          if (input.decision === 'APPROVE') {
            await tx.hotelOwnerProfile.upsert({
              where: { userId: application.userId },
              create: {
                userId: application.userId,
                isActive: true,
                verifiedAt: now,
              },
              update: { isActive: true, verifiedAt: now },
            });
            const granted = await tx.user.updateMany({
              where: {
                id: application.userId,
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                isActive: true,
              },
              data: { role: UserRole.HOTEL_OWNER },
            });
            if (granted.count !== 1)
              throw new ConflictException(
                'Quyền tài khoản đã thay đổi. Vui lòng tải lại.',
              );
          }

          const audit = await tx.ownerApplicationAudit.create({
            data: {
              applicationId: id,
              applicantId: application.userId,
              actorId: actor.id,
              action:
                input.decision === 'APPROVE'
                  ? 'OWNER_APPLICATION_APPROVED'
                  : 'OWNER_APPLICATION_REJECTED',
              oldStatus: OwnerApplicationStatus.PENDING,
              newStatus: nextStatus,
              reason,
              version: application.version,
            },
            select: { id: true },
          });
          await tx.ownerApplicationNotification.create({
            data: {
              applicationId: id,
              userId: application.userId,
              version: application.version,
              title:
                input.decision === 'APPROVE'
                  ? 'Hồ sơ Chủ khách sạn đã được xác minh'
                  : 'Hồ sơ Chủ khách sạn cần bổ sung',
              body:
                input.decision === 'APPROVE'
                  ? 'Hồ sơ của bạn đã được phê duyệt. Bạn có thể chuyển sang chế độ Chủ khách sạn để bắt đầu quản lý chỗ ở.'
                  : 'Hồ sơ đăng ký của bạn chưa được chấp thuận. Vui lòng xem lý do và cập nhật thông tin để gửi lại.',
            },
          });
          return {
            id,
            status: nextStatus,
            version: application.version,
            reviewedAt: now,
            auditId: audit.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      )
        throw new ConflictException('Hồ sơ đang được xử lý. Vui lòng tải lại.');
      throw error;
    }
  }

  async notifications(userId: string) {
    return this.prisma.ownerApplicationNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
        version: true,
      },
    });
  }
}
