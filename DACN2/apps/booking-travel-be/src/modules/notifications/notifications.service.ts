import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.userNotification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Không tìm thấy thông báo.');
    return this.prisma.userNotification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
  }

  async readAll(userId: string) {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async registerDevice(userId: string, input: RegisterDeviceTokenDto) {
    const now = new Date();
    return this.prisma.pushDeviceToken.upsert({
      where: { token: input.token },
      create: {
        userId,
        token: input.token,
        platform: input.platform,
        enabled: true,
        lastRegisteredAt: now,
      },
      update: {
        userId,
        platform: input.platform,
        enabled: true,
        lastRegisteredAt: now,
      },
    });
  }

  async revokeDevice(userId: string, token: string) {
    const result = await this.prisma.pushDeviceToken.updateMany({
      where: { userId, token },
      data: { enabled: false },
    });
    return { revoked: result.count > 0 };
  }

  async createNotification(input: CreateNotificationInput) {
    const notification = await this.prisma.userNotification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data:
          input.data === undefined
            ? undefined
            : (input.data as Prisma.InputJsonValue),
      },
    });
    await this.sendExpoPush(input.userId, input.title, input.body, input.data);
    return notification;
  }

  private async sendExpoPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const devices = await this.prisma.pushDeviceToken.findMany({
      where: { userId, enabled: true },
      select: { token: true },
    });
    if (!devices.length) return;

    const messages = devices
      .filter(({ token }) => /^ExpoPushToken\[.+\]$/.test(token))
      .map(({ token }) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data ?? {},
      }));
    if (!messages.length) return;

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch {
      // Push là kênh tối ưu: notification in-app đã được lưu trước và vẫn hoạt động.
    }
  }
}
