import {
  BadRequestException,
  ConflictException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  VerificationChannel,
  VerificationDeliveryStatus,
  VerificationPurpose,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';

const OTP = '123456';
const RESET_SESSION_ID = '9f5978d5-93bd-4199-8a09-27897f113abc';
const NEW_PASSWORD = 'NewPassword123';
const OLD_PASSWORD = 'OldPassword123';
const OTP_HASH_SECRET = 'password-reset-test-secret';
const NEUTRAL_MESSAGE =
  'Nếu tài khoản tồn tại và đủ điều kiện, mã đặt lại mật khẩu đã được gửi.';

describe('AuthService password reset request', () => {
  type VerificationCreateArgs = {
    data: {
      userId: string;
      sessionId: string;
      purpose: VerificationPurpose;
      channel: VerificationChannel;
      target: string;
      codeHash: string;
      expiresAt: Date;
      resendAvailableAt: Date;
      maxAttempts: number;
      deliveryStatus: VerificationDeliveryStatus;
    };
  };
  type VerificationUpdateManyArgs = {
    where: {
      userId: string;
      purpose: VerificationPurpose;
      consumedAt: null;
    };
    data: { consumedAt: Date };
  };

  const userFindFirst = jest.fn();
  const verificationUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [VerificationUpdateManyArgs]
  >();
  const verificationCreate = jest.fn<
    Promise<{ id: string }>,
    [VerificationCreateArgs]
  >();
  const transaction = {
    verificationCode: {
      updateMany: verificationUpdateMany,
      create: verificationCreate,
    },
  };
  const transactionRunner = jest.fn(
    async (callback: (client: typeof transaction) => Promise<void>) =>
      callback(transaction),
  );
  const prisma = {
    user: { findFirst: userFindFirst },
    $transaction: transactionRunner,
  } as unknown as PrismaService;
  const configValues: Record<string, unknown> = {
    'auth.otpHashSecret': OTP_HASH_SECRET,
    'auth.otpTtlSeconds': 600,
    'auth.otpResendCooldownSeconds': 60,
    'auth.otpMaxAttempts': 5,
    'auth.exposeDevelopmentOtp': false,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    ),
  } as unknown as ConfigService;
  const jwt = {} as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    userFindFirst.mockResolvedValue({
      id: 'user-1',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: null,
    });
    verificationUpdateMany.mockResolvedValue({ count: 1 });
    verificationCreate.mockResolvedValue({ id: 'verification-1' });
    service = new AuthService(prisma, config, jwt);
  });

  it('creates a one-time reset session for a verified identifier', async () => {
    const response = await service.requestPasswordReset({
      identifier: ' Traveler@Example.com ',
    });

    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'traveler@example.com' } }),
    );
    const invalidation = verificationUpdateMany.mock.calls[0][0];
    expect(invalidation.where).toEqual({
      userId: 'user-1',
      purpose: VerificationPurpose.PASSWORD_RESET,
      consumedAt: null,
    });
    expect(invalidation.data.consumedAt).toBeInstanceOf(Date);
    const createArgs = verificationCreate.mock.calls[0][0];
    expect(createArgs.data.purpose).toBe(VerificationPurpose.PASSWORD_RESET);
    expect(createArgs.data.channel).toBe(VerificationChannel.EMAIL);
    expect(createArgs.data.target).toBe('traveler@example.com');
    expect(createArgs.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs.data.codeHash).not.toMatch(/^\d{6}$/);
    expect(response.message).toBe(NEUTRAL_MESSAGE);
    expect(response.reset.resetSessionId).toBe(createArgs.data.sessionId);
    expect(response).not.toHaveProperty('developmentOtp');
  });

  it('returns the same neutral response for an unknown account', async () => {
    userFindFirst.mockResolvedValueOnce(null);

    const response = await service.requestPasswordReset({
      identifier: 'missing@example.com',
    });

    expect(response.message).toBe(NEUTRAL_MESSAGE);
    expect(response.reset.resetSessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.reset.deliveryStatus).toBe(
      VerificationDeliveryStatus.QUEUED,
    );
    expect(transactionRunner).not.toHaveBeenCalled();
  });

  it('does not create a reset session for an unverified channel', async () => {
    userFindFirst.mockResolvedValueOnce({
      id: 'user-1',
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
    });

    const response = await service.requestPasswordReset({
      identifier: 'traveler@example.com',
    });

    expect(response.message).toBe(NEUTRAL_MESSAGE);
    expect(transactionRunner).not.toHaveBeenCalled();
  });
});

describe('AuthService password reset confirmation', () => {
  type VerificationFixture = {
    id: string;
    userId: string;
    sessionId: string;
    purpose: VerificationPurpose;
    codeHash: string;
    consumedAt: Date | null;
    expiresAt: Date;
    attemptCount: number;
    maxAttempts: number;
    resendAvailableAt: Date;
    user: { passwordHash: string };
  };
  type UserUpdateArgs = {
    where: { id: string };
    data: { passwordHash: string };
  };
  type SessionUpdateArgs = {
    where: { userId: string; revokedAt: null };
    data: { revokedAt: Date; lastUsedAt: Date };
  };

  const verificationFindUnique = jest.fn();
  const verificationUpdate = jest.fn();
  const verificationUpdateMany = jest.fn();
  const userUpdate = jest.fn<Promise<{ id: string }>, [UserUpdateArgs]>();
  const sessionUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [SessionUpdateArgs]
  >();
  const transaction = {
    verificationCode: {
      findUnique: verificationFindUnique,
      update: verificationUpdate,
      updateMany: verificationUpdateMany,
    },
    user: { update: userUpdate },
    authSession: { updateMany: sessionUpdateMany },
  };
  const transactionRunner = jest.fn(
    async (callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  );
  const prisma = {
    $transaction: transactionRunner,
  } as unknown as PrismaService;
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'auth.otpHashSecret' ? OTP_HASH_SECRET : fallback,
    ),
  } as unknown as ConfigService;
  const jwt = {} as JwtService;

  let service: AuthService;
  let fixture: VerificationFixture;

  beforeEach(async () => {
    jest.clearAllMocks();
    fixture = {
      id: 'verification-1',
      userId: 'user-1',
      sessionId: RESET_SESSION_ID,
      purpose: VerificationPurpose.PASSWORD_RESET,
      codeHash: createHmac('sha256', OTP_HASH_SECRET)
        .update(`${RESET_SESSION_ID}:${OTP}`)
        .digest('hex'),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
      attemptCount: 0,
      maxAttempts: 5,
      resendAvailableAt: new Date(Date.now() - 1_000),
      user: { passwordHash: await hash(OLD_PASSWORD, 4) },
    };
    verificationFindUnique.mockResolvedValue(fixture);
    verificationUpdate.mockResolvedValue({
      attemptCount: 1,
      maxAttempts: 5,
      resendAvailableAt: fixture.resendAvailableAt,
    });
    verificationUpdateMany.mockResolvedValue({ count: 1 });
    userUpdate.mockResolvedValue({ id: fixture.userId });
    sessionUpdateMany.mockResolvedValue({ count: 2 });
    service = new AuthService(prisma, config, jwt);
  });

  it('updates the password hash, consumes reset codes and revokes sessions', async () => {
    const response = await service.resetPassword({
      resetSessionId: RESET_SESSION_ID,
      otp: OTP,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(response.reset).toBe(true);
    expect(verificationUpdateMany).toHaveBeenCalledTimes(2);
    const userUpdateArgs = userUpdate.mock.calls[0][0];
    expect(userUpdateArgs.where.id).toBe(fixture.userId);
    expect(await compare(NEW_PASSWORD, userUpdateArgs.data.passwordHash)).toBe(
      true,
    );
    expect(await compare(OLD_PASSWORD, userUpdateArgs.data.passwordHash)).toBe(
      false,
    );
    const sessionUpdateArgs = sessionUpdateMany.mock.calls[0][0];
    expect(sessionUpdateArgs.where).toEqual({
      userId: fixture.userId,
      revokedAt: null,
    });
    expect(sessionUpdateArgs.data.revokedAt).toBeInstanceOf(Date);
    expect(sessionUpdateArgs.data.lastUsedAt).toBeInstanceOf(Date);
  });

  it('increments attempts and rejects an incorrect OTP', async () => {
    await expect(
      service.resetPassword({
        resetSessionId: RESET_SESSION_ID,
        otp: '654321',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verificationUpdate).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects expired, consumed and wrong-purpose sessions', async () => {
    verificationFindUnique.mockResolvedValueOnce({
      ...fixture,
      expiresAt: new Date(Date.now() - 1_000),
    });
    await expect(
      service.resetPassword({
        resetSessionId: RESET_SESSION_ID,
        otp: OTP,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(GoneException);

    verificationFindUnique.mockResolvedValueOnce({
      ...fixture,
      consumedAt: new Date(),
    });
    await expect(
      service.resetPassword({
        resetSessionId: RESET_SESSION_ID,
        otp: OTP,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    verificationFindUnique.mockResolvedValueOnce({
      ...fixture,
      purpose: VerificationPurpose.REGISTRATION,
    });
    await expect(
      service.resetPassword({
        resetSessionId: RESET_SESSION_ID,
        otp: OTP,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects mismatched password confirmation before changing data', async () => {
    await expect(
      service.resetPassword({
        resetSessionId: RESET_SESSION_ID,
        otp: OTP,
        newPassword: NEW_PASSWORD,
        confirmPassword: 'DifferentPassword123',
      }),
    ).rejects.toMatchObject({
      response: { code: 'AUTH_PASSWORD_CONFIRMATION_MISMATCH' },
    });

    expect(transactionRunner).not.toHaveBeenCalled();
  });

  it('rejects reuse of the current password', async () => {
    await expect(
      service.resetPassword({
        resetSessionId: RESET_SESSION_ID,
        otp: OTP,
        newPassword: OLD_PASSWORD,
        confirmPassword: OLD_PASSWORD,
      }),
    ).rejects.toMatchObject({
      response: { code: 'AUTH_PASSWORD_REUSE' },
    });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });
});
