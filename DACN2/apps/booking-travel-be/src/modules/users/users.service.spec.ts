import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, UserGender, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { UsersService } from './users.service';

describe('UsersService profile', () => {
  const profile = {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Nguyễn Văn An',
    phone: null,
    avatarUrl: null,
    dateOfBirth: null,
    gender: null,
    nationality: null,
    address: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const findUnique = jest.fn();
  const update = jest.fn<Promise<unknown>, [Prisma.UserUpdateArgs]>();
  const prisma = { user: { findUnique, update } } as unknown as PrismaService;
  const storage = { createUploadUrl: jest.fn() } as unknown as StorageService;
  const service = new UsersService(prisma, storage);

  beforeEach(() => jest.clearAllMocks());

  it('returns only the authenticated user profile', async () => {
    findUnique.mockResolvedValue(profile);

    await expect(service.getProfile('user-1')).resolves.toEqual(profile);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('updates whitelisted profile fields and clears phone verification', async () => {
    findUnique.mockResolvedValue({ id: 'user-1', phone: '0901000000' });
    update.mockResolvedValue({
      ...profile,
      phone: '0902000000',
      gender: UserGender.MALE,
    });

    await service.updateProfile('user-1', {
      phone: '0902000000',
      gender: UserGender.MALE,
    });

    const updateInput = update.mock.calls[0]?.[0];
    expect(updateInput?.where).toEqual({ id: 'user-1' });
    expect(updateInput?.data).toMatchObject({
      phone: '0902000000',
      phoneVerifiedAt: null,
      gender: UserGender.MALE,
    });
  });

  it('rejects a future date of birth', async () => {
    findUnique.mockResolvedValue({ id: 'user-1', phone: null });

    await expect(
      service.updateProfile('user-1', { dateOfBirth: '2999-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('maps duplicate phone errors to a conflict response', async () => {
    findUnique.mockResolvedValue({ id: 'user-1', phone: null });
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.updateProfile('user-1', { phone: '0902000000' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
