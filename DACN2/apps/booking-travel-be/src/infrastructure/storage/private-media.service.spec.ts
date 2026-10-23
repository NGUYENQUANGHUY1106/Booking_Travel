import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import {
  OwnerApplicationStatus,
  OwnerDocumentPurpose,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PrivateMediaService } from './private-media.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://private.example/upload'),
}));

describe('ST-OWN-01 private owner documents', () => {
  const userFindUnique = jest.fn();
  const mediaCreate = jest.fn();
  const mediaDelete = jest.fn();
  const mediaFindUnique = jest.fn();
  const mediaUpdate = jest.fn();
  const send = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
    privateMediaObject: {
      create: mediaCreate,
      delete: mediaDelete,
      findUnique: mediaFindUnique,
      update: mediaUpdate,
    },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) =>
      key === 'storage.bucket' ? 'private-bucket' : 'https://r2.example',
  } as ConfigService;
  const service = new PrivateMediaService(prisma, config);
  Object.assign(service, { client: { send }, bucket: 'private-bucket' });

  const media = {
    id: 'media-a',
    userId: 'user-a',
    purpose: OwnerDocumentPurpose.IDENTITY,
    status: PrivateMediaStatus.RESERVED,
    objectKey: 'owner-verification/user-a/media-a',
    mimeType: 'application/pdf',
    expectedSize: 100,
    createdAt: new Date(),
    verifiedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userFindUnique.mockResolvedValue({
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: null,
      ownerApplication: { status: OwnerApplicationStatus.DRAFT },
    });
    mediaCreate.mockResolvedValue(media);
    mediaFindUnique.mockResolvedValue(media);
    mediaUpdate.mockResolvedValue({
      ...media,
      status: PrivateMediaStatus.READY,
    });
    send.mockImplementation((command: unknown) => {
      if (command instanceof HeadObjectCommand)
        return Promise.resolve({
          ContentLength: 100,
          ContentType: 'application/pdf',
        });
      if (command instanceof GetObjectCommand)
        return Promise.resolve({
          Body: {
            transformToByteArray: () =>
              Promise.resolve(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55])),
          },
        });
      return Promise.resolve({});
    });
  });

  it('rejects uploads outside an editable application', async () => {
    userFindUnique.mockResolvedValue({
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: null,
      ownerApplication: { status: OwnerApplicationStatus.PENDING },
    });
    await expect(
      service.presign(
        'user-a',
        OwnerDocumentPurpose.IDENTITY,
        'application/pdf',
        100,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mediaCreate).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME and oversized files before creating reservations', async () => {
    await expect(
      service.presign(
        'user-a',
        OwnerDocumentPurpose.IDENTITY,
        'text/plain',
        100,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.presign(
        'user-a',
        OwnerDocumentPurpose.IDENTITY,
        'application/pdf',
        11 * 1024 * 1024,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaCreate).not.toHaveBeenCalled();
  });

  it('does not finalize another user’s document', async () => {
    await expect(service.finalize('user-b', media.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a mismatch between declared MIME and object content', async () => {
    send.mockImplementation((command: unknown) =>
      Promise.resolve(
        command instanceof HeadObjectCommand
          ? { ContentLength: 100, ContentType: 'application/pdf' }
          : {
              Body: {
                transformToByteArray: () =>
                  Promise.resolve(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])),
              },
            },
      ),
    );
    await expect(service.finalize('user-a', media.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mediaUpdate).not.toHaveBeenCalled();
  });

  it('finalizes a private file only after size, MIME and signature match', async () => {
    const ready = await service.finalize('user-a', media.id);
    expect(ready).toEqual({
      id: media.id,
      purpose: OwnerDocumentPurpose.IDENTITY,
      status: PrivateMediaStatus.READY,
      mimeType: 'application/pdf',
      sizeBytes: 100,
    });
    expect(mediaUpdate).toHaveBeenCalledTimes(1);
  });
});
