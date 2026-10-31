import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { randomUUID } from 'node:crypto';
import { CreateAvatarUploadDto } from './dto/create-avatar-upload.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  dateOfBirth: true,
  gender: true,
  nationality: true,
  address: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!profile)
      throw new NotFoundException('Không tìm thấy hồ sơ người dùng.');

    return profile;
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!current)
      throw new NotFoundException('Không tìm thấy hồ sơ người dùng.');

    const dateOfBirth = this.parseDateOfBirth(input.dateOfBirth);
    const phoneChanged =
      input.phone !== undefined && input.phone !== current.phone;

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          phoneVerifiedAt: phoneChanged ? null : undefined,
          avatarUrl: input.avatarUrl,
          dateOfBirth,
          gender: input.gender,
          nationality: input.nationality,
          address: input.address,
        },
        select: PROFILE_SELECT,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Số điện thoại đã được tài khoản khác sử dụng.',
        );
      }
      throw error;
    }
  }

  createAvatarUpload(userId: string, input: CreateAvatarUploadDto) {
    const extension =
      input.contentType === 'image/png'
        ? 'png'
        : input.contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const key = `avatars/${userId}/${randomUUID()}.${extension}`;

    return this.storage.createUploadUrl(key, input.contentType);
  }

  private parseDateOfBirth(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const date = new Date(`${value}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date > today) {
      throw new BadRequestException('Ngày sinh không được ở tương lai.');
    }
    if (date.getUTCFullYear() < 1900) {
      throw new BadRequestException('Ngày sinh không hợp lệ.');
    }

    return date;
  }
}
