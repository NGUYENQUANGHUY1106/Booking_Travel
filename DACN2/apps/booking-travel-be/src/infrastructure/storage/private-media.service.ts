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
  OwnerApplicationStatus,
  OwnerDocumentPurpose,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';

export const OWNER_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;
export const OWNER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const OWNER_DOCUMENT_MIN_BYTES = 8;
const UPLOAD_URL_TTL_SECONDS = 300;
const RESERVATION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PrivateMediaService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const endpoint = config.get<string>('storage.endpoint');
    this.bucket = config.get<string>('storage.bucket');
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.client =
      endpoint && this.bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            endpoint,
            region: 'auto',
            forcePathStyle: true,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  private storage() {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình kho tài liệu xác minh riêng tư.',
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  async presign(
    userId: string,
    purpose: OwnerDocumentPurpose,
    mimeType: string,
    sizeBytes: number,
  ) {
    const { client, bucket } = this.storage();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        isActive: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        ownerApplication: { select: { status: true } },
      },
    });
    if (
      !user ||
      user.role !== UserRole.USER ||
      user.status !== UserStatus.ACTIVE ||
      !user.isActive ||
      (!user.emailVerifiedAt && !user.phoneVerifiedAt)
    ) {
      throw new ForbiddenException(
        'Tài khoản không đủ điều kiện tải giấy tờ xác minh.',
      );
    }
    if (
      !user.ownerApplication ||
      (user.ownerApplication.status !== OwnerApplicationStatus.DRAFT &&
        user.ownerApplication.status !== OwnerApplicationStatus.REJECTED)
    ) {
      throw new ConflictException(
        'Hãy tạo hoặc mở hồ sơ nháp trước khi tải tài liệu.',
      );
    }
    if (
      !OWNER_DOCUMENT_MIME_TYPES.includes(
        mimeType as (typeof OWNER_DOCUMENT_MIME_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Tệp phải là JPG, PNG hoặc PDF.');
    }
    if (
      !Number.isInteger(sizeBytes) ||
      sizeBytes < OWNER_DOCUMENT_MIN_BYTES ||
      sizeBytes > OWNER_DOCUMENT_MAX_BYTES
    ) {
      throw new BadRequestException('Tệp không được lớn hơn 10 MB.');
    }

    const objectKey = `owner-verification/${userId}/${randomUUID()}`;
    const media = await this.prisma.privateMediaObject.create({
      data: { userId, purpose, mimeType, expectedSize: sizeBytes, objectKey },
    });
    try {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ContentType: mimeType,
        }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS },
      );
      return {
        mediaId: media.id,
        uploadUrl,
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        mimeType,
        maxBytes: OWNER_DOCUMENT_MAX_BYTES,
      };
    } catch {
      await this.prisma.privateMediaObject.delete({ where: { id: media.id } });
      throw new ServiceUnavailableException(
        'Không thể chuẩn bị tải tài liệu lên.',
      );
    }
  }

  async finalize(userId: string, mediaId: string) {
    const { client, bucket } = this.storage();
    const media = await this.prisma.privateMediaObject.findUnique({
      where: { id: mediaId },
    });
    if (!media || media.userId !== userId)
      throw new NotFoundException('Không tìm thấy tài liệu.');
    if (media.status === PrivateMediaStatus.READY)
      return this.publicMetadata(media);
    if (Date.now() - media.createdAt.getTime() > RESERVATION_TTL_MS) {
      throw new BadRequestException(
        'Phiên tải tài liệu đã hết hạn. Vui lòng chọn lại tệp.',
      );
    }
    if (!media.objectKey.startsWith(`owner-verification/${userId}/`)) {
      throw new ForbiddenException('Tài liệu không thuộc tài khoản này.');
    }

    let head;
    try {
      head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: media.objectKey }),
      );
    } catch {
      throw new BadRequestException(
        'Tài liệu chưa được tải lên hoặc không thể xác minh.',
      );
    }
    if (
      head.ContentLength !== media.expectedSize ||
      head.ContentType?.toLowerCase() !== media.mimeType
    ) {
      throw new BadRequestException(
        'Định dạng hoặc dung lượng tài liệu không khớp. Vui lòng chọn lại tệp.',
      );
    }
    try {
      const object = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: media.objectKey,
          Range: 'bytes=0-7',
        }),
      );
      const signature = await object.Body?.transformToByteArray();
      if (!signature || !this.matchesSignature(signature, media.mimeType)) {
        throw new BadRequestException(
          'Nội dung tệp không khớp định dạng đã khai báo.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Không thể xác minh nội dung tài liệu.');
    }
    const ready = await this.prisma.privateMediaObject.update({
      where: { id: media.id },
      data: { status: PrivateMediaStatus.READY, verifiedAt: new Date() },
    });
    return this.publicMetadata(ready);
  }

  async remove(userId: string, mediaId: string) {
    const { client, bucket } = this.storage();
    const media = await this.prisma.privateMediaObject.findUnique({
      where: { id: mediaId },
      include: { identityApplication: true, licenseApplication: true },
    });
    if (!media || media.userId !== userId)
      throw new NotFoundException('Không tìm thấy tài liệu.');
    if (media.identityApplication || media.licenseApplication) {
      throw new BadRequestException(
        'Hãy lưu bản nháp không dùng tài liệu này trước khi xóa.',
      );
    }
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: media.objectKey }),
    );
    await this.prisma.privateMediaObject.delete({ where: { id: media.id } });
    return { deleted: true };
  }

  async adminReadUrl(mediaId: string) {
    const { client, bucket } = this.storage();
    const media = await this.prisma.privateMediaObject.findUnique({
      where: { id: mediaId },
    });
    if (!media || media.status !== PrivateMediaStatus.READY)
      throw new NotFoundException('Không tìm thấy tài liệu đã xác minh.');
    const accessUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: media.objectKey }),
      { expiresIn: 120 },
    );
    return { accessUrl, expiresIn: 120, mimeType: media.mimeType };
  }

  private publicMetadata(media: {
    id: string;
    purpose: OwnerDocumentPurpose;
    status: PrivateMediaStatus;
    mimeType: string;
    expectedSize: number;
  }) {
    return {
      id: media.id,
      purpose: media.purpose,
      status: media.status,
      mimeType: media.mimeType,
      sizeBytes: media.expectedSize,
    };
  }

  private matchesSignature(bytes: Uint8Array, mimeType: string) {
    if (mimeType === 'image/jpeg')
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mimeType === 'image/png')
      return [137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value,
      );
    if (mimeType === 'application/pdf')
      return [37, 80, 68, 70, 45].every(
        (value, index) => bytes[index] === value,
      );
    return false;
  }
}
