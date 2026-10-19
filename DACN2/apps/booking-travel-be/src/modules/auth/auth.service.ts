import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  UserRole,
  UserStatus,
  VerificationChannel,
  VerificationDeliveryStatus,
  VerificationPurpose,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_HASH_ROUNDS = 12;
const DEFAULT_OTP_TTL_SECONDS = 600;
const DEFAULT_OTP_RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

    const otpHashSecret = this.config.get<string>('auth.otpHashSecret');
    if (!otpHashSecret) {
      throw new InternalServerErrorException(
        'Máy chủ chưa cấu hình khóa bảo vệ mã xác minh.',
      );
    }

    const now = new Date();
    const registrationSessionId = randomUUID();
    const otp = randomInt(100_000, 1_000_000).toString();
    const otpTtlSeconds = this.getPositiveNumber(
      'auth.otpTtlSeconds',
      DEFAULT_OTP_TTL_SECONDS,
    );
    const resendCooldownSeconds = this.getPositiveNumber(
      'auth.otpResendCooldownSeconds',
      DEFAULT_OTP_RESEND_COOLDOWN_SECONDS,
    );
    const expiresAt = new Date(now.getTime() + otpTtlSeconds * 1_000);
    const resendAvailableAt = new Date(
      now.getTime() + resendCooldownSeconds * 1_000,
    );
    const channel = email ? VerificationChannel.EMAIL : VerificationChannel.SMS;
    const target = email ?? phone!;
    const codeHash = createHmac('sha256', otpHashSecret)
      .update(`${registrationSessionId}:${otp}`)
      .digest('hex');
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
              sessionId: registrationSessionId,
              purpose: VerificationPurpose.REGISTRATION,
              channel,
              target,
              codeHash,
              expiresAt,
              resendAvailableAt,
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

      return {
        message: 'Đăng ký thành công. Vui lòng xác minh tài khoản.',
        user: result.user,
        verification: {
          registrationSessionId: result.verification.sessionId,
          channel: result.verification.channel,
          target: this.maskTarget(target, channel),
          expiresAt: result.verification.expiresAt,
          resendAvailableAt: result.verification.resendAvailableAt,
          deliveryStatus: result.verification.deliveryStatus,
        },
        ...(this.config.get<boolean>('auth.exposeDevelopmentOtp')
          ? { developmentOtp: otp }
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

  private throwIdentifierConflict(): never {
    throw new ConflictException({
      code: 'AUTH_IDENTIFIER_EXISTS',
      message: 'Email hoặc số điện thoại đã được sử dụng.',
    });
  }
}
