import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UserRole,
  UserStatus,
  VerificationChannel,
  VerificationDeliveryStatus,
  VerificationPurpose,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashed-password'),
}));

describe('AuthService', () => {
  type TestUser = {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    role: UserRole;
    status: UserStatus;
  };
  type UserCreateArgs = {
    data: {
      email?: string;
      phone?: string;
      passwordHash: string;
      fullName: string;
      role: UserRole;
      status: UserStatus;
      isActive: boolean;
      termsAcceptedAt: Date;
    };
  };
  type VerificationCreateArgs = {
    data: {
      sessionId: string;
      purpose: VerificationPurpose;
      channel: VerificationChannel;
      codeHash: string;
      expiresAt: Date;
      resendAvailableAt: Date;
      deliveryStatus: VerificationDeliveryStatus;
    };
  };
  type VerificationResult = {
    sessionId: string;
    channel: VerificationChannel;
    expiresAt: Date;
    resendAvailableAt: Date;
    deliveryStatus: VerificationDeliveryStatus;
  };

  const transaction = {
    user: {
      findFirst: jest.fn<Promise<{ id: string } | null>, []>(),
      create: jest.fn<Promise<TestUser>, [UserCreateArgs]>(),
    },
    verificationCode: {
      create: jest.fn<Promise<VerificationResult>, [VerificationCreateArgs]>(
        ({ data }) =>
          Promise.resolve({
            sessionId: data.sessionId,
            channel: data.channel,
            expiresAt: data.expiresAt,
            resendAvailableAt: data.resendAvailableAt,
            deliveryStatus: data.deliveryStatus,
          }),
      ),
    },
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
    'auth.exposeDevelopmentOtp': false,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    ),
  } as unknown as ConfigService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.user.findFirst.mockResolvedValue(null);
    transaction.user.create.mockResolvedValue({
      id: 'user-1',
      fullName: 'Nguyễn Văn An',
      email: 'an@example.com',
      phone: undefined,
      role: UserRole.USER,
      status: UserStatus.PENDING_VERIFICATION,
    });
    service = new AuthService(prisma, config);
  });

  it('creates exactly one pending USER and one hashed verification code', async () => {
    const input: RegisterDto = {
      fullName: '  Nguyễn Văn An  ',
      email: '  AN@Example.COM ',
      password: 'Demo1234',
      confirmPassword: 'Demo1234',
      acceptedTerms: true,
    };

    const response = await service.register(input);

    expect(transaction.user.create).toHaveBeenCalledTimes(1);
    expect(transaction.verificationCode.create).toHaveBeenCalledTimes(1);
    const userCreateArgs = transaction.user.create.mock.calls[0][0];
    expect(userCreateArgs.data.email).toBe('an@example.com');
    expect(userCreateArgs.data.fullName).toBe('Nguyễn Văn An');
    expect(userCreateArgs.data.passwordHash).toBe('$2b$12$hashed-password');
    expect(userCreateArgs.data.role).toBe(UserRole.USER);
    expect(userCreateArgs.data.status).toBe(UserStatus.PENDING_VERIFICATION);
    expect(userCreateArgs.data.isActive).toBe(false);

    const verificationArgs =
      transaction.verificationCode.create.mock.calls[0][0];
    expect(verificationArgs.data.purpose).toBe(
      VerificationPurpose.REGISTRATION,
    );
    expect(verificationArgs.data.channel).toBe(VerificationChannel.EMAIL);
    expect(verificationArgs.data.deliveryStatus).toBe(
      VerificationDeliveryStatus.QUEUED,
    );
    expect(verificationArgs.data.codeHash).not.toMatch(/^\d{6}$/);
    expect(hash).toHaveBeenCalledWith('Demo1234', 12);
    expect(response).not.toHaveProperty('developmentOtp');
    expect(response.user).not.toHaveProperty('passwordHash');
    expect(response.verification.target).toBe('an***@example.com');
  });

  it('normalizes a Vietnamese phone number before storing it', async () => {
    transaction.user.create.mockResolvedValueOnce({
      id: 'user-2',
      fullName: 'Nguyễn Văn Bình',
      email: undefined,
      phone: '+84901234567',
      role: UserRole.USER,
      status: UserStatus.PENDING_VERIFICATION,
    });

    await service.register({
      fullName: 'Nguyễn Văn Bình',
      phone: '090 123 4567',
      password: 'Demo1234',
      confirmPassword: 'Demo1234',
      acceptedTerms: true,
    });

    expect(transaction.user.create.mock.calls[0][0].data.phone).toBe(
      '+84901234567',
    );
  });

  it('rejects duplicate email or phone', async () => {
    transaction.user.findFirst.mockResolvedValueOnce({ id: 'existing-user' });

    await expect(
      service.register({
        fullName: 'Nguyễn Văn An',
        email: 'an@example.com',
        password: 'Demo1234',
        confirmPassword: 'Demo1234',
        acceptedTerms: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.user.create).not.toHaveBeenCalled();
  });

  it('requires an email or phone and matching passwords', async () => {
    await expect(
      service.register({
        fullName: 'Nguyễn Văn An',
        password: 'Demo1234',
        confirmPassword: 'Demo1234',
        acceptedTerms: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.register({
        fullName: 'Nguyễn Văn An',
        email: 'an@example.com',
        password: 'Demo1234',
        confirmPassword: 'Different123',
        acceptedTerms: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionRunner).not.toHaveBeenCalled();
  });
});
