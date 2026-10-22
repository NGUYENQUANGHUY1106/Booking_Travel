import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  OwnerApplicationStatus,
  OwnerDocumentPurpose,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PrivateMediaService } from '../../infrastructure/storage/private-media.service';
import { OwnerApplicationsService } from './owner-applications.service';

describe('ST-OWN-01 owner applications', () => {
  const userFindUnique = jest.fn();
  const userUpdate = jest.fn();
  const applicationFindUnique = jest.fn();
  const applicationFindFirst = jest.fn();
  const applicationFindUniqueOrThrow = jest.fn();
  const applicationCreate = jest.fn();
  const applicationUpdateMany = jest.fn();
  const mediaFindFirst = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique, update: userUpdate },
    hotelOwnerApplication: {
      findUnique: applicationFindUnique,
      findFirst: applicationFindFirst,
      findUniqueOrThrow: applicationFindUniqueOrThrow,
      create: applicationCreate,
      updateMany: applicationUpdateMany,
    },
    privateMediaObject: { findFirst: mediaFindFirst },
  } as unknown as PrismaService;
  const service = new OwnerApplicationsService(
    prisma,
    {} as PrivateMediaService,
  );

  const user = {
    id: 'user-a',
    fullName: 'Nguyễn Văn A',
    email: 'a@example.com',
    phone: null,
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isActive: true,
  };
  const application = {
    id: 'application-a',
    userId: user.id,
    status: OwnerApplicationStatus.DRAFT,
    version: 1,
    revision: 0,
    reviewHistory: [],
    businessName: 'Khách sạn A',
    businessAddress: 'Hà Nội',
    identityDocumentId: 'identity-a',
    businessLicenseDocumentId: 'license-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userFindUnique.mockResolvedValue(user);
    applicationFindUnique.mockResolvedValue(null);
    applicationFindFirst.mockResolvedValue(application);
    applicationFindUniqueOrThrow.mockResolvedValue({
      ...application,
      status: OwnerApplicationStatus.PENDING,
    });
    applicationCreate.mockResolvedValue(application);
    applicationUpdateMany.mockResolvedValue({ count: 1 });
    mediaFindFirst.mockImplementation(
      ({ where }: { where: { id: string; purpose: OwnerDocumentPurpose } }) =>
        Promise.resolve({
          id: where.id,
          purpose: where.purpose,
          objectKey: `owner-verification/${user.id}/file`,
          status: PrivateMediaStatus.READY,
        }),
    );
  });

  it('keeps a single draft for the same user', async () => {
    applicationFindUnique.mockResolvedValue(application);
    await expect(service.createDraft(user.id)).resolves.toEqual(application);
    expect(applicationCreate).not.toHaveBeenCalled();
  });

  it('rejects a second application after submission', async () => {
    applicationFindUnique.mockResolvedValue({
      ...application,
      status: OwnerApplicationStatus.PENDING,
    });
    await expect(service.createDraft(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not expose or update another user’s application', async () => {
    applicationFindFirst.mockResolvedValue(null);
    await expect(
      service.updateDraft(user.id, 'application-b', { businessName: 'Sai' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(applicationUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a document that is not ready and owned by the applicant', async () => {
    mediaFindFirst.mockResolvedValue(null);
    await expect(
      service.updateDraft(user.id, application.id, {
        identityDocumentId: 'other-user-document',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(applicationUpdateMany).not.toHaveBeenCalled();
  });

  it('submits a valid draft without granting HOTEL_OWNER role', async () => {
    await expect(
      service.submit(user.id, application.id),
    ).resolves.toMatchObject({ status: OwnerApplicationStatus.PENDING });
    const submittedCall = applicationUpdateMany.mock.calls[0] as unknown as [
      { where: { userId: string }; data: { status: OwnerApplicationStatus } },
    ];
    expect(submittedCall[0].where.userId).toBe(user.id);
    expect(submittedCall[0].data.status).toBe(OwnerApplicationStatus.PENDING);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('makes repeat submit idempotent', async () => {
    applicationFindFirst.mockResolvedValue({
      ...application,
      status: OwnerApplicationStatus.PENDING,
    });
    await expect(
      service.submit(user.id, application.id),
    ).resolves.toMatchObject({ status: OwnerApplicationStatus.PENDING });
    expect(applicationUpdateMany).not.toHaveBeenCalled();
  });

  it('increments version when resubmitting a rejected application and retains feedback', async () => {
    applicationFindFirst.mockResolvedValue({
      ...application,
      status: OwnerApplicationStatus.REJECTED,
      rejectionReason: 'Thiếu thông tin',
    });
    await service.submit(user.id, application.id);
    const submittedCall = applicationUpdateMany.mock.calls[0] as unknown as [
      {
        data: {
          version: { increment: number };
          rejectionReason?: string | null;
          reviewHistory?: { version: number; reason: string }[];
        };
      },
    ];
    expect(submittedCall[0].data.version.increment).toBe(1);
    expect(submittedCall[0].data.rejectionReason).toBeNull();
    expect(submittedCall[0].data.reviewHistory?.[0]).toMatchObject({
      version: 1,
      reason: 'Thiếu thông tin',
    });
  });

  it('rejects incomplete application before changing state', async () => {
    applicationFindFirst.mockResolvedValue({
      ...application,
      businessName: ' ',
    });
    await expect(
      service.submit(user.id, application.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(applicationUpdateMany).not.toHaveBeenCalled();
  });
});
