import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OwnerApplicationStatus,
  OwnerDocumentPurpose,
  Prisma,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PrivateMediaService } from '../../infrastructure/storage/private-media.service';
import { UpdateOwnerApplicationDto } from './dto/update-owner-application.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const APPLICATION_INCLUDE = {
  identityDocument: {
    select: {
      id: true,
      purpose: true,
      status: true,
      mimeType: true,
      expectedSize: true,
    },
  },
  businessLicenseDocument: {
    select: {
      id: true,
      purpose: true,
      status: true,
      mimeType: true,
      expectedSize: true,
    },
  },
} satisfies Prisma.HotelOwnerApplicationInclude;

@Injectable()
export class OwnerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: PrivateMediaService,
  ) {}

  async current(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        role: true,
        status: true,
        isActive: true,
      },
    });
    if (
      !user ||
      !user.isActive ||
      user.status !== UserStatus.ACTIVE ||
      (user.role !== UserRole.USER && user.role !== UserRole.HOTEL_OWNER)
    )
      throw new ForbiddenException(
        'Tài khoản không thể xem hồ sơ chủ khách sạn.',
      );
    const application = await this.prisma.hotelOwnerApplication.findUnique({
      where: { userId },
      include: APPLICATION_INCLUDE,
    });
    return {
      applicant: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        emailVerified: Boolean(user.emailVerifiedAt),
        phoneVerified: Boolean(user.phoneVerifiedAt),
      },
      application,
    };
  }

  async createDraft(userId: string) {
    await this.requireApplicant(userId);
    const existing = await this.prisma.hotelOwnerApplication.findUnique({
      where: { userId },
      include: APPLICATION_INCLUDE,
    });
    if (existing) {
      if (
        existing.status === OwnerApplicationStatus.DRAFT ||
        existing.status === OwnerApplicationStatus.REJECTED
      )
        return existing;
      throw new ConflictException('Hồ sơ đã được nộp hoặc xác minh.');
    }
    try {
      return await this.prisma.hotelOwnerApplication.create({
        data: { userId },
        include: APPLICATION_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.hotelOwnerApplication.findUniqueOrThrow({
          where: { userId },
          include: APPLICATION_INCLUDE,
        });
      }
      throw error;
    }
  }

  async updateDraft(
    userId: string,
    id: string,
    input: UpdateOwnerApplicationDto,
  ) {
    await this.requireApplicant(userId);
    const existing = await this.ownedApplication(userId, id);
    this.requireEditable(existing.status);

    if (input.identityDocumentId)
      await this.requireDocument(
        userId,
        input.identityDocumentId,
        OwnerDocumentPurpose.IDENTITY,
      );
    if (input.businessLicenseDocumentId)
      await this.requireDocument(
        userId,
        input.businessLicenseDocumentId,
        OwnerDocumentPurpose.BUSINESS_LICENSE,
      );

    const data: Prisma.HotelOwnerApplicationUncheckedUpdateManyInput = {};
    for (const field of [
      'businessName',
      'businessAddress',
      'representativeName',
      'businessRegistrationNumber',
      'businessPhone',
    ] as const) {
      if (input[field] !== undefined)
        data[field] = input[field]?.trim() || null;
    }
    if (input.identityDocumentId !== undefined)
      data.identityDocumentId = input.identityDocumentId;
    if (input.businessLicenseDocumentId !== undefined)
      data.businessLicenseDocumentId = input.businessLicenseDocumentId;

    const updated = await this.prisma.hotelOwnerApplication.updateMany({
      where: {
        id,
        userId,
        revision: existing.revision,
        status: {
          in: [OwnerApplicationStatus.DRAFT, OwnerApplicationStatus.REJECTED],
        },
      },
      data: { ...data, revision: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        'Hồ sơ đã thay đổi. Vui lòng tải lại trước khi sửa.',
      );
    return this.prisma.hotelOwnerApplication.findUniqueOrThrow({
      where: { id },
      include: APPLICATION_INCLUDE,
    });
  }

  async submit(userId: string, id: string) {
    const user = await this.requireApplicant(userId);
    const application = await this.ownedApplication(userId, id);
    if (application.status === OwnerApplicationStatus.PENDING) {
      return this.prisma.hotelOwnerApplication.findUniqueOrThrow({
        where: { id },
        include: APPLICATION_INCLUDE,
      });
    }
    this.requireEditable(application.status);
    if (
      !user.fullName.trim() ||
      (!user.emailVerifiedAt && !user.phoneVerifiedAt)
    ) {
      throw new ForbiddenException(
        'Vui lòng xác minh email hoặc số điện thoại trước khi nộp hồ sơ.',
      );
    }
    if (!application.businessName?.trim())
      throw new BadRequestException('Vui lòng nhập tên cơ sở kinh doanh.');
    if (!application.businessAddress?.trim())
      throw new BadRequestException('Vui lòng nhập địa chỉ cơ sở kinh doanh.');
    if (
      !application.identityDocumentId ||
      !application.businessLicenseDocumentId
    ) {
      throw new BadRequestException(
        'Vui lòng bổ sung đầy đủ giấy tờ xác minh.',
      );
    }
    await this.requireDocument(
      userId,
      application.identityDocumentId,
      OwnerDocumentPurpose.IDENTITY,
    );
    await this.requireDocument(
      userId,
      application.businessLicenseDocumentId,
      OwnerDocumentPurpose.BUSINESS_LICENSE,
    );

    const reviewHistory = Array.isArray(application.reviewHistory)
      ? application.reviewHistory
      : [];
    const previousRejection =
      application.status === OwnerApplicationStatus.REJECTED &&
      application.rejectionReason
        ? {
            version: application.version,
            reason: application.rejectionReason,
            resubmittedAt: new Date().toISOString(),
          }
        : null;

    const updated = await this.prisma.hotelOwnerApplication.updateMany({
      where: {
        id,
        userId,
        revision: application.revision,
        status: {
          in: [OwnerApplicationStatus.DRAFT, OwnerApplicationStatus.REJECTED],
        },
      },
      data: {
        status: OwnerApplicationStatus.PENDING,
        submittedAt: new Date(),
        ...(previousRejection
          ? {
              reviewHistory: [
                ...reviewHistory,
                previousRejection,
              ] as Prisma.InputJsonValue,
              rejectionReason: null,
              reviewedById: null,
              reviewedAt: null,
              approvalNote: null,
            }
          : {}),
        version: {
          increment:
            application.status === OwnerApplicationStatus.REJECTED ? 1 : 0,
        },
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('Hồ sơ đã thay đổi. Vui lòng tải lại.');
    return this.prisma.hotelOwnerApplication.findUniqueOrThrow({
      where: { id },
      include: APPLICATION_INCLUDE,
    });
  }

  async listPending() {
    return this.prisma.hotelOwnerApplication.findMany({
      where: { status: OwnerApplicationStatus.PENDING },
      orderBy: { submittedAt: 'asc' },
      select: {
        id: true,
        status: true,
        version: true,
        businessName: true,
        businessAddress: true,
        submittedAt: true,
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        identityDocument: {
          select: {
            id: true,
            status: true,
            mimeType: true,
            expectedSize: true,
          },
        },
        businessLicenseDocument: {
          select: {
            id: true,
            status: true,
            mimeType: true,
            expectedSize: true,
          },
        },
      },
    });
  }

  async adminDetail(id: string) {
    const application = await this.prisma.hotelOwnerApplication.findUnique({
      where: { id },
      include: {
        ...APPLICATION_INCLUDE,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
          },
        },
      },
    });
    if (!application) throw new NotFoundException('Không tìm thấy hồ sơ.');
    return application;
  }

  async adminDocumentAccess(
    id: string,
    purpose: OwnerDocumentPurpose,
    actor: AuthenticatedUser,
  ) {
    if (
      actor.role !== UserRole.ADMIN ||
      !actor.permissions.includes('HOTEL_REVIEW')
    )
      throw new ForbiddenException('Bạn không có quyền xem tài liệu xác minh.');
    const application = await this.adminDetail(id);
    const documentId =
      purpose === OwnerDocumentPurpose.IDENTITY
        ? application.identityDocumentId
        : application.businessLicenseDocumentId;
    if (!documentId) throw new NotFoundException('Hồ sơ chưa có tài liệu này.');
    const document = await this.prisma.privateMediaObject.findFirst({
      where: {
        id: documentId,
        userId: application.userId,
        purpose,
        status: PrivateMediaStatus.READY,
        verifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (!document)
      throw new NotFoundException('Không tìm thấy tài liệu hợp lệ của hồ sơ.');
    const access = await this.media.adminReadUrl(documentId);
    await this.prisma.ownerApplicationAudit.create({
      data: {
        applicationId: application.id,
        applicantId: application.userId,
        actorId: actor.id,
        action: 'OWNER_DOCUMENT_ACCESS_GRANTED',
        oldStatus: application.status,
        newStatus: application.status,
        reason: purpose,
        version: application.version,
      },
    });
    return access;
  }

  private async ownedApplication(userId: string, id: string) {
    const application = await this.prisma.hotelOwnerApplication.findFirst({
      where: { id, userId },
    });
    if (!application) throw new NotFoundException('Không tìm thấy hồ sơ.');
    return application;
  }

  private async requireApplicant(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        role: true,
        status: true,
        isActive: true,
      },
    });
    if (
      !user ||
      user.role !== UserRole.USER ||
      !user.isActive ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'Tài khoản không đủ điều kiện đăng ký chủ khách sạn.',
      );
    }
    if (!user.emailVerifiedAt && !user.phoneVerifiedAt) {
      throw new ForbiddenException(
        'Vui lòng xác minh email hoặc số điện thoại trước khi đăng ký.',
      );
    }
    return user;
  }

  private requireEditable(status: OwnerApplicationStatus) {
    if (
      status !== OwnerApplicationStatus.DRAFT &&
      status !== OwnerApplicationStatus.REJECTED
    ) {
      throw new ConflictException('Hồ sơ không còn có thể chỉnh sửa.');
    }
  }

  private async requireDocument(
    userId: string,
    id: string,
    purpose: OwnerDocumentPurpose,
  ) {
    const document = await this.prisma.privateMediaObject.findFirst({
      where: { id, userId, purpose, status: PrivateMediaStatus.READY },
    });
    if (
      !document ||
      !document.objectKey.startsWith(`owner-verification/${userId}/`)
    ) {
      throw new BadRequestException(
        'Tài liệu xác minh không hợp lệ hoặc chưa tải lên thành công.',
      );
    }
    return document;
  }
}
