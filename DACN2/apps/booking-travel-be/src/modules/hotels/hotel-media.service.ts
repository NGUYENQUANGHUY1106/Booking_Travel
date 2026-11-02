import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  HotelMedia,
  HotelMediaStatus,
  HotelStatus,
  Prisma,
} from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { Request } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export const HOTEL_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const HOTEL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const URL_TTL_SECONDS = 15 * 60;
const RESERVATION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class HotelMediaService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly secret: string;
  private readonly localDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const endpoint = config.get<string>('storage.endpoint');
    this.bucket = config.get<string>('storage.bucket');
    const accessKeyId = config.get<string>('storage.accessKeyId');
    const secretAccessKey = config.get<string>('storage.secretAccessKey');
    this.client =
      endpoint && this.bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            endpoint,
            region: 'auto',
            forcePathStyle: true,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
    this.secret = config.get<string>('auth.accessSecret') ?? '';
    this.localDir = resolve(
      process.env.LOCAL_MEDIA_DIR ?? '../../.local-media',
    );
  }

  private storageMode() {
    if (this.client && this.bucket) return 'r2' as const;
    if (process.env.NODE_ENV !== 'production') return 'local' as const;
    throw new ServiceUnavailableException('Kho ảnh chưa được cấu hình.');
  }

  private localPath(mediaId: string) {
    if (!/^[a-z0-9]+$/i.test(mediaId))
      throw new BadRequestException('Mã ảnh không hợp lệ.');
    return resolve(this.localDir, mediaId);
  }

  private signature(mediaId: string, operation: string, expires: number) {
    if (!this.secret)
      throw new ServiceUnavailableException('Chưa cấu hình khóa ký URL ảnh.');
    return createHmac('sha256', this.secret)
      .update(`${mediaId}:${operation}:${expires}`)
      .digest('hex');
  }

  private signedPath(mediaId: string, operation: 'read' | 'upload') {
    const expires = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    return `/api/hotel-media/${mediaId}/content?e=${expires}&op=${operation}&s=${this.signature(mediaId, operation, expires)}`;
  }

  private verifySignature(
    mediaId: string,
    operation: 'read' | 'upload',
    expiresText: string,
    signature: string,
  ) {
    const expires = Number(expiresText);
    if (
      !Number.isSafeInteger(expires) ||
      expires < Math.floor(Date.now() / 1000) ||
      expires > Math.floor(Date.now() / 1000) + URL_TTL_SECONDS + 60
    ) {
      throw new ForbiddenException('Liên kết ảnh đã hết hạn.');
    }
    const expected = Buffer.from(
      this.signature(mediaId, operation, expires),
      'hex',
    );
    const actual = /^[a-f0-9]{64}$/i.test(signature)
      ? Buffer.from(signature, 'hex')
      : Buffer.alloc(0);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new ForbiddenException('Liên kết ảnh không hợp lệ.');
  }

  private async editableHotel(hotelId: string, ownerId: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, ownerId, deletedAt: null },
      select: { status: true, profileVersion: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy chỗ ở.');
    if (
      hotel.status !== HotelStatus.DRAFT &&
      hotel.status !== HotelStatus.REJECTED
    )
      throw new ConflictException('Trạng thái hiện tại không cho sửa ảnh.');
    return hotel;
  }

  private async cleanupExpiredReservations() {
    const expired = await this.prisma.hotelMedia.findMany({
      where: {
        status: HotelMediaStatus.RESERVED,
        createdAt: { lt: new Date(Date.now() - RESERVATION_TTL_MS) },
      },
      select: { id: true, objectKey: true },
      take: 100,
    });
    for (const media of expired) {
      try {
        if (this.storageMode() === 'local')
          await unlink(this.localPath(media.id)).catch(() => undefined);
        else
          await this.client!.send(
            new DeleteObjectCommand({
              Bucket: this.bucket!,
              Key: media.objectKey,
            }),
          );
        await this.prisma.hotelMedia.deleteMany({
          where: { id: media.id, status: HotelMediaStatus.RESERVED },
        });
      } catch {
        // Retry cleanup when another media upload begins.
      }
    }
  }

  async presign(
    hotelId: string,
    user: AuthenticatedUser,
    mimeType: string,
    sizeBytes: number,
  ) {
    await this.editableHotel(hotelId, user.id);
    await this.cleanupExpiredReservations();
    if (
      !HOTEL_IMAGE_TYPES.includes(
        mimeType as (typeof HOTEL_IMAGE_TYPES)[number],
      )
    )
      throw new BadRequestException('Ảnh phải là JPG, PNG hoặc WebP.');
    if (
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 8 ||
      sizeBytes > HOTEL_IMAGE_MAX_BYTES
    )
      throw new BadRequestException('Ảnh phải từ 8 byte đến 10 MB.');
    const objectKey = `hotel-images/${hotelId}/${user.id}/${randomUUID()}`;
    const media = await this.prisma.hotelMedia.create({
      data: {
        hotelId,
        ownerId: user.id,
        objectKey,
        mimeType,
        expectedSize: sizeBytes,
      },
    });
    try {
      const mode = this.storageMode();
      const uploadUrl =
        mode === 'local'
          ? this.signedPath(media.id, 'upload')
          : await getSignedUrl(
              this.client!,
              new PutObjectCommand({
                Bucket: this.bucket!,
                Key: objectKey,
                ContentType: mimeType,
              }),
              { expiresIn: URL_TTL_SECONDS },
            );
      return {
        mediaId: media.id,
        uploadUrl,
        mimeType,
        maxBytes: HOTEL_IMAGE_MAX_BYTES,
        expiresIn: URL_TTL_SECONDS,
      };
    } catch (error) {
      await this.prisma.hotelMedia.delete({ where: { id: media.id } });
      throw error;
    }
  }

  async putLocal(
    mediaId: string,
    expires: string,
    signature: string,
    request: Request,
  ) {
    if (this.storageMode() !== 'local')
      throw new NotFoundException('Không có endpoint tải ảnh cục bộ.');
    this.verifySignature(mediaId, 'upload', expires, signature);
    const media = await this.prisma.hotelMedia.findFirst({
      where: {
        id: mediaId,
        status: HotelMediaStatus.RESERVED,
        deletedAt: null,
      },
      include: {
        hotel: { select: { ownerId: true, status: true, deletedAt: true } },
      },
    });
    if (
      !media ||
      media.ownerId !== media.hotel.ownerId ||
      media.hotel.deletedAt ||
      (media.hotel.status !== HotelStatus.DRAFT &&
        media.hotel.status !== HotelStatus.REJECTED)
    )
      throw new NotFoundException('Không tìm thấy phiên tải ảnh.');
    if (Date.now() - media.createdAt.getTime() > RESERVATION_TTL_MS)
      throw new ConflictException('Phiên tải ảnh đã hết hạn.');
    if (
      request.headers['content-type']?.split(';')[0].toLowerCase() !==
      media.mimeType
    )
      throw new BadRequestException('Định dạng ảnh không khớp.');
    const target = this.localPath(media.id);
    await mkdir(this.localDir, { recursive: true });
    let bytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(
          bytes <= media.expectedSize
            ? null
            : new Error('Ảnh vượt dung lượng đã khai báo.'),
          chunk,
        );
      },
    });
    try {
      await pipeline(
        request,
        limiter,
        createWriteStream(target, { flags: 'w' }),
      );
      if (bytes !== media.expectedSize)
        throw new BadRequestException('Dung lượng ảnh không khớp.');
    } catch (error) {
      await unlink(target).catch(() => undefined);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Tải ảnh không thành công hoặc dung lượng không khớp.',
      );
    }
    return { uploaded: true };
  }

  private matchesSignature(bytes: Uint8Array, mimeType: string) {
    if (mimeType === 'image/jpeg')
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mimeType === 'image/png')
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  async finalize(hotelId: string, user: AuthenticatedUser, mediaId: string) {
    const media = await this.prisma.hotelMedia.findFirst({
      where: {
        id: mediaId,
        hotelId,
        ownerId: user.id,
        deletedAt: null,
        hotel: { ownerId: user.id, deletedAt: null },
      },
    });
    if (!media)
      throw new NotFoundException('Không tìm thấy ảnh của chỗ ở này.');
    if (media.status === HotelMediaStatus.READY) return this.metadata(media);
    await this.editableHotel(hotelId, user.id);
    if (Date.now() - media.createdAt.getTime() > RESERVATION_TTL_MS)
      throw new ConflictException('Phiên tải ảnh đã hết hạn.');
    let size: number;
    let signature: Uint8Array;
    if (this.storageMode() === 'local') {
      const file = await readFile(this.localPath(media.id)).catch(() => null);
      if (!file) throw new BadRequestException('Ảnh chưa được tải lên.');
      size = file.length;
      signature = file.subarray(0, 12);
    } else {
      const head = await this.client!.send(
        new HeadObjectCommand({ Bucket: this.bucket!, Key: media.objectKey }),
      ).catch(() => null);
      if (!head) throw new BadRequestException('Ảnh chưa được tải lên.');
      size = head.ContentLength ?? -1;
      if (head.ContentType?.toLowerCase() !== media.mimeType)
        throw new BadRequestException('Định dạng ảnh không khớp.');
      const object = await this.client!.send(
        new GetObjectCommand({
          Bucket: this.bucket!,
          Key: media.objectKey,
          Range: 'bytes=0-11',
        }),
      );
      signature =
        (await object.Body?.transformToByteArray()) ?? new Uint8Array();
    }
    if (
      size !== media.expectedSize ||
      !this.matchesSignature(signature, media.mimeType)
    )
      throw new BadRequestException('Nội dung hoặc dung lượng ảnh không khớp.');
    const ready = await this.prisma.$transaction(async (tx) => {
      const last = await tx.hotelMedia.aggregate({
        where: { hotelId, status: HotelMediaStatus.READY, deletedAt: null },
        _max: { sortOrder: true },
        _count: true,
      });
      const result = await tx.hotelMedia.updateMany({
        where: {
          id: mediaId,
          hotelId,
          ownerId: user.id,
          status: HotelMediaStatus.RESERVED,
          deletedAt: null,
        },
        data: {
          status: HotelMediaStatus.READY,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          isCover: last._count === 0,
          verifiedAt: new Date(),
        },
      });
      if (!result.count) throw new ConflictException('Ảnh đã thay đổi.');
      await tx.hotel.update({
        where: { id: hotelId },
        data: { profileVersion: { increment: 1 } },
      });
      return tx.hotelMedia.findUniqueOrThrow({ where: { id: mediaId } });
    });
    return this.metadata(ready);
  }

  private metadata(media: HotelMedia) {
    return {
      id: media.id,
      mimeType: media.mimeType,
      sizeBytes: media.expectedSize,
      sortOrder: media.sortOrder,
      isCover: media.isCover,
      url: this.signedPath(media.id, 'read'),
    };
  }

  async listMetadata(hotelIds: string[]) {
    if (!hotelIds.length)
      return new Map<string, ReturnType<HotelMediaService['metadata']>[]>();
    const rows = await this.prisma.hotelMedia.findMany({
      where: {
        hotelId: { in: hotelIds },
        status: HotelMediaStatus.READY,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const result = new Map<
      string,
      ReturnType<HotelMediaService['metadata']>[]
    >();
    for (const row of rows)
      result.set(row.hotelId, [
        ...(result.get(row.hotelId) ?? []),
        this.metadata(row),
      ]);
    return result;
  }

  private async mutate(
    hotelId: string,
    user: AuthenticatedUser,
    expectedVersion: number,
    action: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    await this.editableHotel(hotelId, user.id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotel.updateMany({
        where: {
          id: hotelId,
          ownerId: user.id,
          deletedAt: null,
          profileVersion: expectedVersion,
          status: { in: [HotelStatus.DRAFT, HotelStatus.REJECTED] },
        },
        data: { profileVersion: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException(
          'Hồ sơ đã thay đổi. Hãy tải lại trước khi lưu ảnh.',
        );
      await action(tx);
    });
  }

  async setCover(
    hotelId: string,
    user: AuthenticatedUser,
    mediaId: string,
    expectedVersion: number,
  ) {
    await this.mutate(hotelId, user, expectedVersion, async (tx) => {
      const target = await tx.hotelMedia.findFirst({
        where: {
          id: mediaId,
          hotelId,
          ownerId: user.id,
          status: HotelMediaStatus.READY,
          deletedAt: null,
        },
      });
      if (!target) throw new NotFoundException('Không tìm thấy ảnh.');
      await tx.hotelMedia.updateMany({
        where: { hotelId, isCover: true },
        data: { isCover: false },
      });
      await tx.hotelMedia.update({
        where: { id: mediaId },
        data: { isCover: true },
      });
    });
  }

  async reorder(
    hotelId: string,
    user: AuthenticatedUser,
    mediaIds: string[],
    expectedVersion: number,
  ) {
    await this.mutate(hotelId, user, expectedVersion, async (tx) => {
      const rows = await tx.hotelMedia.findMany({
        where: {
          hotelId,
          ownerId: user.id,
          status: HotelMediaStatus.READY,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (
        rows.length !== mediaIds.length ||
        new Set(mediaIds).size !== mediaIds.length ||
        rows.some((row) => !mediaIds.includes(row.id))
      )
        throw new BadRequestException(
          'Thứ tự ảnh không khớp gallery hiện tại.',
        );
      for (const [index, id] of mediaIds.entries())
        await tx.hotelMedia.update({
          where: { id },
          data: { sortOrder: index },
        });
    });
  }

  async remove(
    hotelId: string,
    user: AuthenticatedUser,
    mediaId: string,
    expectedVersion: number,
  ) {
    await this.mutate(hotelId, user, expectedVersion, async (tx) => {
      const target = await tx.hotelMedia.findFirst({
        where: {
          id: mediaId,
          hotelId,
          ownerId: user.id,
          status: HotelMediaStatus.READY,
          deletedAt: null,
        },
      });
      if (!target) throw new NotFoundException('Không tìm thấy ảnh.');
      await tx.hotelMedia.update({
        where: { id: mediaId },
        data: { deletedAt: new Date(), isCover: false },
      });
      if (target.isCover) {
        const next = await tx.hotelMedia.findFirst({
          where: { hotelId, status: HotelMediaStatus.READY, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        });
        if (next)
          await tx.hotelMedia.update({
            where: { id: next.id },
            data: { isCover: true },
          });
      }
    });
  }

  async read(mediaId: string, expires: string, signature: string) {
    this.verifySignature(mediaId, 'read', expires, signature);
    const media = await this.prisma.hotelMedia.findFirst({
      where: {
        id: mediaId,
        status: HotelMediaStatus.READY,
        deletedAt: null,
        hotel: { deletedAt: null },
      },
      include: { hotel: { select: { status: true, ownerId: true } } },
    });
    if (!media) throw new NotFoundException('Không tìm thấy ảnh.');
    if (media.hotel.status !== HotelStatus.APPROVED) {
      const owner = await this.prisma.user.findUnique({
        where: { id: media.ownerId },
        select: {
          isActive: true,
          role: true,
          ownerApplication: { select: { status: true } },
          ownerProfile: { select: { isActive: true } },
        },
      });
      if (
        !owner?.isActive ||
        owner.role !== 'HOTEL_OWNER' ||
        owner.ownerApplication?.status !== 'VERIFIED' ||
        !owner.ownerProfile?.isActive
      )
        throw new ForbiddenException('Ảnh riêng tư không còn khả dụng.');
    }
    if (this.storageMode() === 'local') {
      const target = this.localPath(media.id);
      const file = await readFile(target).catch(() => null);
      if (!file) throw new NotFoundException('Ảnh không còn trên kho lưu trữ.');
      return { bytes: file, mimeType: media.mimeType };
    }
    const object = await this.client!.send(
      new GetObjectCommand({ Bucket: this.bucket!, Key: media.objectKey }),
    );
    const bytes = Buffer.from(
      (await object.Body?.transformToByteArray()) ?? new Uint8Array(),
    );
    return { bytes, mimeType: media.mimeType };
  }
}
