import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.adminProfile.findMany({
      include: {
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
    });
    if (!admin) throw new NotFoundException('Không tìm thấy quản trị viên.');
    return admin;
  }

  async create(input: CreateAdminDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: { adminProfile: true },
    });
    if (!user)
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    if (user.adminProfile) {
      throw new ConflictException('Tài khoản đã có hồ sơ quản trị viên.');
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN },
      });
      return transaction.adminProfile.create({
        data: {
          userId: user.id,
          title: input.title?.trim(),
          permissions: input.permissions ?? [],
        },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, isActive: true },
          },
        },
      });
    });
  }

  async update(id: string, input: UpdateAdminDto) {
    await this.get(id);
    return this.prisma.adminProfile.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        permissions: input.permissions,
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const admin = await this.get(id);
    await this.prisma.$transaction([
      this.prisma.adminProfile.delete({ where: { id } }),
      this.prisma.user.update({
        where: { id: admin.userId },
        data: { role: UserRole.USER },
      }),
    ]);
  }
}
