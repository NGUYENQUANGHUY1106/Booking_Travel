import {
  ConflictException,
  GoneException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UserRole,
  UserStatus,
  VerificationChannel,
  VerificationDeliveryStatus,
  VerificationPurpose,
} from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService verification', () => {
  type VerificationFixture = {
    id: string;
    userId: string;
    sessionId: string;
    purpose: VerificationPurpose;
    channel: VerificationChannel;
    target: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    sendCount: number;
    attemptCount: number;
    maxAttempts: number;
    deliveryStatus: VerificationDeliveryStatus;
    consumedAt: Date | null;
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: null;
      role: UserRole;
      status: UserStatus;
      isActive: boolean;
    };
  };
  type VerificationUpdateArgs = {
    data: { attemptCount: { increment: number } };
  };
  type VerificationUpdateManyArgs = {
    data: { consumedAt: Date };
  };
  type VerificationCreateArgs = {
    data: {
      sessionId: string;
      codeHash: string;
      sendCount: number;
      maxAttempts: number;
    };
  };
  type UserUpdateArgs = {
    data: {
      emailVerifiedAt?: Date;
      phoneVerifiedAt?: Date;
      status?: UserStatus;
      isActive?: boolean;
    };
  };
  type VerifiedUser = {
    id: string;
    fullName: string;
    email: string;
    phone: null;
    role: UserRole;
    status: UserStatus;
    isActive: boolean;
    emailVerifiedAt: Date;
    phoneVerifiedAt: null;
  };
  type ResendResult = {
    sessionId: string;
    channel: VerificationChannel;
    target: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    deliveryStatus: VerificationDeliveryStatus;
    sendCount: number;
  };

  const verificationFindUnique = jest.fn<
    Promise<VerificationFixture | null>,
    [unknown]
  >();
  const verificationUpdate = jest.fn<
    Promise<{
      attemptCount: number;
      maxAttempts: number;
      resendAvailableAt: Date;
    }>,
    [VerificationUpdateArgs]
  >();
  const verificationUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [VerificationUpdateManyArgs]
  >();
  const verificationCreate = jest.fn<
    Promise<ResendResult>,
    [VerificationCreateArgs]
  >();
  const userUpdate = jest.fn<Promise<VerifiedUser>, [UserUpdateArgs]>();
  const transaction = {
    verificationCode: {
      findUnique: verificationFindUnique,
      update: verificationUpdate,
      updateMany: verificationUpdateMany,
      create: verificationCreate,
    },
    user: { update: userUpdate },
  };
  const transactionRunner = jest.fn(
    async (callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  );
  const prisma = {
    $transaction: transactionRunner,
  } as unknown as PrismaService;
  const configValues: Record<string, unknown> = {
    'auth.otpHashSecret': 'test-otp-secret',
    'auth.otpTtlSeconds': 600,
    'auth.otpResendCooldownSeconds': 60,
    'auth.otpMaxAttempts': 5,
    'auth.otpMaxSends': 5,
    'auth.exposeDevelopmentOtp': false,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    ),
  } as unknown as ConfigService;
  const jwt = { signAsync: jest.fn() } as unknown as JwtService;

  const OTP = '123456';
  const SESSION_ID = '9f5978d5-93bd-4199-8a09-27897f113abc';
  let service: AuthService;
  let fixture: VerificationFixture;

  beforeEach(() => {
    jest.clearAllMocks();
    const now = Date.now();
    fixture = {
      id: 'verification-1',
      userId: 'user-1',
      sessionId: SESSION_ID,
      purpose: VerificationPurpose.REGISTRATION,
      channel: VerificationChannel.EMAIL,
      target: 'an@example.com',
      codeHash: createHmac('sha256', 'test-otp-secret')
        .update(`${SESSION_ID}:${OTP}`)
        .digest('hex'),
      expiresAt: new Date(now + 600_000),
      resendAvailableAt: new Date(now - 1_000),
      sendCount: 1,
      attemptCount: 0,
      maxAttempts: 5,
      deliveryStatus: VerificationDeliveryStatus.QUEUED,
      consumedAt: null,
      user: {
        id: 'user-1',
        fullName: 'Nguyễn Văn An',
        email: 'an@example.com',
        phone: null,
        role: UserRole.USER,
        status: UserStatus.PENDING_VERIFICATION,
        isActive: false,
      },
    };
    verificationFindUnique.mockResolvedValue(fixture);
    verificationUpdate.mockResolvedValue({
      attemptCount: 1,
      maxAttempts: 5,
      resendAvailableAt: fixture.resendAvailableAt,
    });
    verificationUpdateMany.mockResolvedValue({ count: 1 });
    userUpdate.mockResolvedValue({
      ...fixture.user,
      status: UserStatus.ACTIVE,
      isActive: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: null,
    });
    verificationCreate.mockResolvedValue({
      sessionId: '7fb84b6e-f2c5-43b0-a19c-028c69f1998d',
      channel: VerificationChannel.EMAIL,
      target: fixture.target,
      expiresAt: new Date(now + 600_000),
      resendAvailableAt: new Date(now + 60_000),
      deliveryStatus: VerificationDeliveryStatus.QUEUED,
      sendCount: 2,
    });
    service = new AuthService(prisma, config, jwt);
  });

  it('consumes a correct OTP once and activates the registration account', async () => {
    const response = await service.verify({
      verificationSessionId: SESSION_ID,
      otp: OTP,
    });

    expect(verificationUpdateMany).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const userUpdateArgs = userUpdate.mock.calls[0][0];
    expect(userUpdateArgs.data.status).toBe(UserStatus.ACTIVE);
    expect(userUpdateArgs.data.isActive).toBe(true);
    expect(userUpdateArgs.data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(response.verified).toBe(true);
    expect(response.user.status).toBe(UserStatus.ACTIVE);
  });

  it('increments failed attempts when the OTP is wrong', async () => {
    await expect(
      service.verify({
        verificationSessionId: SESSION_ID,
        otp: '654321',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verificationUpdate).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('locks the verification session after the maximum failed attempt', async () => {
    verificationUpdate.mockResolvedValueOnce({
      attemptCount: 5,
      maxAttempts: 5,
      resendAvailableAt: fixture.resendAvailableAt,
    });

    let thrown: unknown;
    try {
      await service.verify({
        verificationSessionId: SESSION_ID,
        otp: '654321',
      });
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
  });

  it('rejects expired and already consumed OTPs', async () => {
    verificationFindUnique.mockResolvedValueOnce({
      ...fixture,
      expiresAt: new Date(Date.now() - 1_000),
    });
    await expect(
      service.verify({ verificationSessionId: SESSION_ID, otp: OTP }),
    ).rejects.toBeInstanceOf(GoneException);

    verificationFindUnique.mockResolvedValueOnce({
      ...fixture,
      consumedAt: new Date(),
    });
    await expect(
      service.verify({ verificationSessionId: SESSION_ID, otp: OTP }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('invalidates the old OTP and creates a new session when resending', async () => {
    const response = await service.resendVerification({
      verificationSessionId: SESSION_ID,
    });

    expect(verificationUpdateMany).toHaveBeenCalledTimes(1);
    expect(verificationCreate).toHaveBeenCalledTimes(1);
    const createArgs = verificationCreate.mock.calls[0][0];
    expect(createArgs.data.sessionId).not.toBe(SESSION_ID);
    expect(createArgs.data.codeHash).not.toMatch(/^\d{6}$/);
    expect(createArgs.data.sendCount).toBe(2);
    expect(response.verification.sendCount).toBe(2);
    expect(response).not.toHaveProperty('developmentOtp');
  });

  it('enforces the resend cooldown', async () => {
    verificationFindUnique.mockResolvedValueOnce({
      ...fixture,
      resendAvailableAt: new Date(Date.now() + 60_000),
    });

    let thrown: unknown;
    try {
      await service.resendVerification({ verificationSessionId: SESSION_ID });
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect(verificationCreate).not.toHaveBeenCalled();
  });
});
