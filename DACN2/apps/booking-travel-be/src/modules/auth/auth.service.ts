import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  Prisma,
  UserRole,
  UserStatus,
  VerificationChannel,
  VerificationDeliveryStatus,
  VerificationPurpose,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import {
  createHash,
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH =
  '$2b$12$yXXIQ52tgAhmM1oXiHHCxOwJC1ibVMYJ4XgFkJeI./m.GnaFOdbRO';
const DEFAULT_OTP_TTL_SECONDS = 600;
const DEFAULT_OTP_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_OTP_MAX_ATTEMPTS = 5;
const DEFAULT_OTP_MAX_SENDS = 5;

type VerificationState = {
  consumedAt: Date | null;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
  resendAvailableAt: Date;
};

type AuthRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type RefreshTokenPayload = {
  sub?: unknown;
  sessionId?: unknown;
  type?: unknown;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email?.trim().toLowerCase() || undefined;
    const phone = input.phone ? this.normalizePhone(input.phone) : undefined;

    if (!email && !phone) {
      throw new BadRequestException({
        code: 'AUTH_IDENTIFIER_REQUIRED',
        message: 'Vui lòng cung cấp email hoặc số điện thoại.',
      });
    }
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_CONFIRMATION_MISMATCH',
        message: 'Mật khẩu xác nhận không khớp.',
      });
    }
    if (
      Buffer.byteLength(input.password, 'utf8') > 72 ||
      Buffer.byteLength(input.confirmPassword, 'utf8') > 72
    ) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_TOO_LONG',
        message: 'Mật khẩu không được vượt quá 72 byte.',
      });
    }

    const now = new Date();
    const otpContext = this.createOtpContext(now);
    const channel = email ? VerificationChannel.EMAIL : VerificationChannel.SMS;
    const target = email ?? phone!;
    const passwordHash = await hash(input.password, PASSWORD_HASH_ROUNDS);

    try {
      const result = await this.prisma.$transaction(
        async (transaction) => {
          const identifiers: Prisma.UserWhereInput[] = [];
          if (email) identifiers.push({ email });
          if (phone) identifiers.push({ phone });

          const existingUser = await transaction.user.findFirst({
            where: { OR: identifiers },
            select: { id: true },
          });
          if (existingUser) this.throwIdentifierConflict();

          const user = await transaction.user.create({
            data: {
              email,
              phone,
              passwordHash,
              fullName: input.fullName.trim(),
              role: UserRole.USER,
              status: UserStatus.PENDING_VERIFICATION,
              isActive: false,
              termsAcceptedAt: now,
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
              status: true,
            },
          });

          const verification = await transaction.verificationCode.create({
            data: {
              userId: user.id,
              sessionId: otpContext.verificationSessionId,
              purpose: VerificationPurpose.REGISTRATION,
              channel,
              target,
              codeHash: otpContext.codeHash,
              expiresAt: otpContext.expiresAt,
              resendAvailableAt: otpContext.resendAvailableAt,
              maxAttempts: this.getPositiveInteger(
                'auth.otpMaxAttempts',
                DEFAULT_OTP_MAX_ATTEMPTS,
              ),
              deliveryStatus: VerificationDeliveryStatus.QUEUED,
            },
            select: {
              sessionId: true,
              channel: true,
              expiresAt: true,
              resendAvailableAt: true,
              deliveryStatus: true,
            },
          });

          return { user, verification };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      this.logDevelopmentOtp(result.verification.sessionId, otpContext.otp);

      return {
        message: 'Đăng ký thành công. Vui lòng xác minh tài khoản.',
        user: result.user,
        verification: {
          verificationSessionId: result.verification.sessionId,
          channel: result.verification.channel,
          target: this.maskTarget(target, channel),
          expiresAt: result.verification.expiresAt,
          resendAvailableAt: result.verification.resendAvailableAt,
          deliveryStatus: result.verification.deliveryStatus,
        },
        ...(this.config.get<boolean>('auth.exposeDevelopmentOtp')
          ? { developmentOtp: otpContext.otp }
          : {}),
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.throwIdentifierConflict();
      }
      throw error;
    }
  }

  async login(input: LoginDto, context: AuthRequestContext = {}) {
    const identifier = input.identifier.trim();
    const isEmail = identifier.includes('@');
    let normalizedIdentifier: string;

    try {
      normalizedIdentifier = isEmail
        ? identifier.toLowerCase()
        : this.normalizePhone(identifier);
    } catch {
      this.throwInvalidCredentials();
    }

    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: normalizedIdentifier }
        : { phone: normalizedIdentifier },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        passwordHash: true,
        role: true,
        status: true,
        isActive: true,
      },
    });
    const passwordMatches = await this.passwordMatches(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) this.throwInvalidCredentials();

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_NOT_VERIFIED',
        message: 'Tài khoản chưa được xác minh.',
      });
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_SUSPENDED',
        message: 'Tài khoản đang bị tạm khóa.',
      });
    }
    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_LOCKED',
        message: 'Tài khoản đang bị khóa.',
      });
    }
    if (user.status === UserStatus.DISABLED || !user.isActive) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa.',
      });
    }

    const sessionId = randomUUID();
    const now = new Date();
    const tokens = await this.issueTokenPair(
      user.id,
      user.role,
      sessionId,
      now,
    );

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(tokens.refreshToken),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: tokens.refreshTokenExpiresAt,
        lastUsedAt: now,
      },
    });

    return {
      message: 'Đăng nhập thành công.',
      tokenType: 'Bearer',
      ...tokens,
      sessionId,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    };
  }

  async refresh(input: RefreshTokenDto, context: AuthRequestContext = {}) {
    const refreshSecret = this.getRequiredSecret('auth.refreshSecret');
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        input.refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      this.throwInvalidRefreshToken();
    }

    if (
      payload.type !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.sessionId !== 'string' ||
      !payload.sessionId
    ) {
      this.throwInvalidRefreshToken();
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            isActive: true,
          },
        },
      },
    });
    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      this.throwInvalidRefreshToken();
    }

    if (session.user.status !== UserStatus.ACTIVE || !session.user.isActive) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now },
      });
      this.throwAccountUnavailable(session.user.status, session.user.isActive);
    }

    const currentRefreshTokenHash = this.hashRefreshToken(input.refreshToken);
    if (
      !this.safeHashEquals(session.refreshTokenHash, currentRefreshTokenHash)
    ) {
      this.throwInvalidRefreshToken();
    }

    const tokens = await this.issueTokenPair(
      session.user.id,
      session.user.role,
      session.id,
      now,
    );
    const rotation = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        userId: session.user.id,
        refreshTokenHash: currentRefreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: this.hashRefreshToken(tokens.refreshToken),
        expiresAt: tokens.refreshTokenExpiresAt,
        lastUsedAt: now,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    if (rotation.count !== 1) this.throwInvalidRefreshToken();

    return {
      message: 'Làm mới phiên đăng nhập thành công.',
      tokenType: 'Bearer',
      ...tokens,
      sessionId: session.id,
      user: {
        id: session.user.id,
        fullName: session.user.fullName,
        email: session.user.email,
        phone: session.user.phone,
        role: session.user.role,
        status: session.user.status,
      },
    };
  }

  async verify(input: VerifyOtpDto) {
    const now = new Date();

    try {
      const outcome = await this.prisma.$transaction(
        async (transaction) => {
          const verification = await transaction.verificationCode.findUnique({
            where: { sessionId: input.verificationSessionId },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  role: true,
                  status: true,
                  isActive: true,
                },
              },
            },
          });
          if (!verification) this.throwInvalidVerificationSession();

          this.assertVerificationUsable(verification, now);

          const suppliedHash = this.hashOtp(verification.sessionId, input.otp);
          if (!this.safeHashEquals(verification.codeHash, suppliedHash)) {
            const failedAttempt = await transaction.verificationCode.update({
              where: { id: verification.id },
              data: { attemptCount: { increment: 1 } },
              select: {
                attemptCount: true,
                maxAttempts: true,
                resendAvailableAt: true,
              },
            });

            return { kind: 'INVALID_OTP' as const, ...failedAttempt };
          }

          const consumed = await transaction.verificationCode.updateMany({
            where: {
              id: verification.id,
              consumedAt: null,
              expiresAt: { gt: now },
              attemptCount: { lt: verification.maxAttempts },
            },
            data: { consumedAt: now },
          });
          if (consumed.count !== 1) {
            throw new ConflictException({
              code: 'AUTH_OTP_ALREADY_USED',
              message: 'OTP đã được sử dụng hoặc không còn hiệu lực.',
            });
          }

          const shouldActivate =
            verification.purpose === VerificationPurpose.REGISTRATION &&
            verification.user.status === UserStatus.PENDING_VERIFICATION;
          const user = await transaction.user.update({
            where: { id: verification.userId },
            data: {
              emailVerifiedAt:
                verification.channel === VerificationChannel.EMAIL
                  ? now
                  : undefined,
              phoneVerifiedAt:
                verification.channel === VerificationChannel.SMS
                  ? now
                  : undefined,
              status: shouldActivate ? UserStatus.ACTIVE : undefined,
              isActive: shouldActivate ? true : undefined,
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
              status: true,
              isActive: true,
              emailVerifiedAt: true,
              phoneVerifiedAt: true,
            },
          });

          return {
            kind: 'VERIFIED' as const,
            user,
            channel: verification.channel,
            verifiedAt: now,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (outcome.kind === 'INVALID_OTP') {
        const remainingAttempts = Math.max(
          0,
          outcome.maxAttempts - outcome.attemptCount,
        );
        if (remainingAttempts === 0) {
          throw new HttpException(
            {
              code: 'AUTH_OTP_ATTEMPTS_EXCEEDED',
              message:
                'Phiên xác minh đã bị khóa do nhập sai OTP quá số lần cho phép.',
              resendAvailableAt: outcome.resendAvailableAt,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        throw new UnauthorizedException({
          code: 'AUTH_OTP_INVALID',
          message: 'OTP không chính xác.',
          remainingAttempts,
        });
      }

      return {
        message: 'Xác minh tài khoản thành công.',
        verified: true,
        user: outcome.user,
        verification: {
          verificationSessionId: input.verificationSessionId,
          channel: outcome.channel,
          verifiedAt: outcome.verifiedAt,
        },
      };
    } catch (error: unknown) {
      this.rethrowConcurrentVerificationError(error);
    }
  }

  async resendVerification(input: ResendVerificationDto) {
    const now = new Date();
    const otpContext = this.createOtpContext(now);
    const maxSends = this.getPositiveInteger(
      'auth.otpMaxSends',
      DEFAULT_OTP_MAX_SENDS,
    );

    try {
      const verification = await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.verificationCode.findUnique({
            where: { sessionId: input.verificationSessionId },
            include: {
              user: { select: { status: true, isActive: true } },
            },
          });
          if (!current) this.throwInvalidVerificationSession();
          if (current.consumedAt) {
            throw new ConflictException({
              code: 'AUTH_VERIFICATION_SESSION_CONSUMED',
              message: 'Phiên xác minh đã được sử dụng.',
            });
          }
          if (current.user.status === UserStatus.ACTIVE) {
            throw new ConflictException({
              code: 'AUTH_ACCOUNT_ALREADY_VERIFIED',
              message: 'Tài khoản đã được xác minh.',
            });
          }
          if (now < current.resendAvailableAt) {
            throw new HttpException(
              {
                code: 'AUTH_OTP_RESEND_COOLDOWN',
                message: 'Vui lòng chờ trước khi yêu cầu gửi lại OTP.',
                retryAfterSeconds: Math.ceil(
                  (current.resendAvailableAt.getTime() - now.getTime()) / 1_000,
                ),
                resendAvailableAt: current.resendAvailableAt,
              },
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
          if (current.sendCount >= maxSends) {
            throw new HttpException(
              {
                code: 'AUTH_OTP_SEND_LIMIT_EXCEEDED',
                message: 'Đã vượt quá số lần gửi OTP cho phép.',
              },
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }

          const invalidated = await transaction.verificationCode.updateMany({
            where: {
              id: current.id,
              consumedAt: null,
              resendAvailableAt: { lte: now },
            },
            data: { consumedAt: now },
          });
          if (invalidated.count !== 1) {
            throw new ConflictException({
              code: 'AUTH_VERIFICATION_SESSION_CHANGED',
              message: 'Phiên xác minh đã thay đổi. Vui lòng thử lại.',
            });
          }

          return transaction.verificationCode.create({
            data: {
              userId: current.userId,
              sessionId: otpContext.verificationSessionId,
              purpose: current.purpose,
              channel: current.channel,
              target: current.target,
              codeHash: otpContext.codeHash,
              expiresAt: otpContext.expiresAt,
              resendAvailableAt: otpContext.resendAvailableAt,
              sendCount: current.sendCount + 1,
              maxAttempts: this.getPositiveInteger(
                'auth.otpMaxAttempts',
                DEFAULT_OTP_MAX_ATTEMPTS,
              ),
              deliveryStatus: VerificationDeliveryStatus.QUEUED,
            },
            select: {
              sessionId: true,
              channel: true,
              target: true,
              expiresAt: true,
              resendAvailableAt: true,
              deliveryStatus: true,
              sendCount: true,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      this.logDevelopmentOtp(verification.sessionId, otpContext.otp);

      return {
        message: 'Đã tạo OTP xác minh mới.',
        verification: {
          verificationSessionId: verification.sessionId,
          channel: verification.channel,
          target: this.maskTarget(verification.target, verification.channel),
          expiresAt: verification.expiresAt,
          resendAvailableAt: verification.resendAvailableAt,
          deliveryStatus: verification.deliveryStatus,
          sendCount: verification.sendCount,
        },
        ...(this.config.get<boolean>('auth.exposeDevelopmentOtp')
          ? { developmentOtp: otpContext.otp }
          : {}),
      };
    } catch (error: unknown) {
      this.rethrowConcurrentVerificationError(error);
    }
  }

  private normalizePhone(value: string): string {
    const compact = value.trim().replace(/[\s().-]/g, '');
    let normalized = compact;
    if (compact.startsWith('0')) normalized = `+84${compact.slice(1)}`;
    else if (compact.startsWith('84')) normalized = `+${compact}`;

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new BadRequestException({
        code: 'AUTH_PHONE_INVALID',
        message: 'Số điện thoại không đúng định dạng.',
      });
    }
    return normalized;
  }

  private async passwordMatches(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    try {
      return await compare(password, passwordHash);
    } catch {
      return false;
    }
  }

  private async issueTokenPair(
    userId: string,
    role: UserRole,
    sessionId: string,
    now: Date,
  ) {
    const accessSecret = this.getRequiredSecret('auth.accessSecret');
    const refreshSecret = this.getRequiredSecret('auth.refreshSecret');
    const accessTokenExpiresIn = this.getPositiveInteger(
      'auth.accessTtlSeconds',
      900,
    );
    const refreshTtlSeconds = this.getPositiveInteger(
      'auth.refreshTtlSeconds',
      2_592_000,
    );
    const claims = {
      sub: userId,
      role,
      roles: [role],
      sessionId,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(claims, {
        secret: accessSecret,
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwt.signAsync(
        { ...claims, type: 'refresh' },
        { secret: refreshSecret, expiresIn: refreshTtlSeconds },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresAt: new Date(
        now.getTime() + refreshTtlSeconds * 1_000,
      ),
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getRequiredSecret(key: string): string {
    const secret = this.config.get<string>(key);
    if (!secret) {
      throw new InternalServerErrorException(
        'Máy chủ chưa cấu hình khóa xác thực.',
      );
    }
    return secret;
  }

  private maskTarget(target: string, channel: VerificationChannel): string {
    if (channel === VerificationChannel.SMS) {
      return `${target.slice(0, 3)}******${target.slice(-3)}`;
    }

    const [localPart, domain] = target.split('@');
    const visible = localPart.slice(0, Math.min(2, localPart.length));
    return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
  }

  private getPositiveNumber(key: string, fallback: number): number {
    const value = this.config.get<number>(key, fallback);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private getPositiveInteger(key: string, fallback: number): number {
    return Math.floor(this.getPositiveNumber(key, fallback));
  }

  private createOtpContext(now: Date) {
    const verificationSessionId = randomUUID();
    const otp = randomInt(100_000, 1_000_000).toString();
    const otpTtlSeconds = this.getPositiveNumber(
      'auth.otpTtlSeconds',
      DEFAULT_OTP_TTL_SECONDS,
    );
    const resendCooldownSeconds = this.getPositiveNumber(
      'auth.otpResendCooldownSeconds',
      DEFAULT_OTP_RESEND_COOLDOWN_SECONDS,
    );

    return {
      verificationSessionId,
      otp,
      codeHash: this.hashOtp(verificationSessionId, otp),
      expiresAt: new Date(now.getTime() + otpTtlSeconds * 1_000),
      resendAvailableAt: new Date(
        now.getTime() + resendCooldownSeconds * 1_000,
      ),
    };
  }

  private hashOtp(verificationSessionId: string, otp: string): string {
    const otpHashSecret = this.config.get<string>('auth.otpHashSecret');
    if (!otpHashSecret) {
      throw new InternalServerErrorException(
        'Máy chủ chưa cấu hình khóa bảo vệ mã xác minh.',
      );
    }

    return createHmac('sha256', otpHashSecret)
      .update(`${verificationSessionId}:${otp}`)
      .digest('hex');
  }

  private safeHashEquals(expected: string, received: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  private logDevelopmentOtp(verificationSessionId: string, otp: string): void {
    if (!this.config.get<boolean>('auth.exposeDevelopmentOtp')) return;

    this.logger.warn(
      `[DEV ONLY] OTP cho phiên ${verificationSessionId}: ${otp}`,
    );
  }

  private assertVerificationUsable(
    verification: VerificationState,
    now: Date,
  ): void {
    if (verification.consumedAt) {
      throw new ConflictException({
        code: 'AUTH_OTP_ALREADY_USED',
        message: 'OTP đã được sử dụng.',
      });
    }
    if (verification.expiresAt <= now) {
      throw new GoneException({
        code: 'AUTH_OTP_EXPIRED',
        message: 'OTP đã hết hạn. Vui lòng yêu cầu gửi lại.',
        resendAvailableAt: verification.resendAvailableAt,
      });
    }
    if (verification.attemptCount >= verification.maxAttempts) {
      throw new HttpException(
        {
          code: 'AUTH_OTP_ATTEMPTS_EXCEEDED',
          message: 'Phiên xác minh đã bị khóa do nhập sai OTP quá nhiều lần.',
          resendAvailableAt: verification.resendAvailableAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private throwInvalidVerificationSession(): never {
    throw new BadRequestException({
      code: 'AUTH_VERIFICATION_SESSION_INVALID',
      message: 'Phiên xác minh không hợp lệ.',
    });
  }

  private rethrowConcurrentVerificationError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException({
        code: 'AUTH_VERIFICATION_CONCURRENT_UPDATE',
        message: 'Phiên xác minh vừa thay đổi. Vui lòng thử lại.',
      });
    }
    throw error;
  }

  private throwIdentifierConflict(): never {
    throw new ConflictException({
      code: 'AUTH_IDENTIFIER_EXISTS',
      message: 'Email hoặc số điện thoại đã được sử dụng.',
    });
  }

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Email, số điện thoại hoặc mật khẩu không chính xác.',
    });
  }

  private throwInvalidRefreshToken(): never {
    throw new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_INVALID',
      message:
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }

  private throwAccountUnavailable(
    status: UserStatus,
    isActive: boolean,
  ): never {
    if (status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_SUSPENDED',
        message: 'Tài khoản đang bị tạm khóa.',
      });
    }
    if (status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_NOT_VERIFIED',
        message: 'Tài khoản chưa được xác minh.',
      });
    }
    if (status === UserStatus.DISABLED || !isActive) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa.',
      });
    }

    this.throwInvalidRefreshToken();
  }
}
