import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertAssignablePermissions(
    requested: string[] | undefined,
    actor: AuthenticatedUser,
  ): void {
    if (
      requested?.some((permission) => !actor.permissions.includes(permission))
    ) {
      throw new ForbiddenException(
        'Không được cấp quyền quản trị ngoài quyền của bạn.',
      );
    }
  }

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

  async create(input: CreateAdminDto, actor: AuthenticatedUser) {
    this.assertAssignablePermissions(input.permissions, actor);
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: { adminProfile: true },
    });
    if (!user)
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    if (user.adminProfile) {
      throw new ConflictException('Tài khoản đã có hồ sơ quản trị viên.');
    }

    const admin = await this.prisma.$transaction(async (transaction) => {
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
    this.audit.recordSuccess(actor, 'ADMIN_CREATE', 'ADMIN_PROFILE', admin.id);
    return admin;
  }

  async update(id: string, input: UpdateAdminDto, actor: AuthenticatedUser) {
    this.assertAssignablePermissions(input.permissions, actor);
    await this.get(id);
    const admin = await this.prisma.adminProfile.update({
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
    this.audit.recordSuccess(actor, 'ADMIN_UPDATE', 'ADMIN_PROFILE', id);
    return admin;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const admin = await this.get(id);
    await this.prisma.$transaction([
      this.prisma.adminProfile.delete({ where: { id } }),
      this.prisma.user.update({
        where: { id: admin.userId },
        data: { role: UserRole.USER },
      }),
    ]);
    this.audit.recordSuccess(actor, 'ADMIN_DELETE', 'ADMIN_PROFILE', id);
  }
}
