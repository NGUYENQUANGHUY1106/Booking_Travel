import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OwnerCoverLocalService } from './owner-cover-local.service';

const UPLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly localCover: OwnerCoverLocalService,
  ) {}

  isOwnerApplicationCoverUrl(userId: string, url: string) {
    const publicBaseUrl = this.config.get<string>('storage.publicBaseUrl');
    if (!publicBaseUrl) return false;
    const prefix = `${publicBaseUrl.replace(/\/$/, '')}/owner-applications/${encodeURIComponent(userId)}/`;
    return (
      url.startsWith(prefix) &&
      /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(url.slice(prefix.length))
    );
  }

  async verifyOwnerApplicationCoverUrl(userId: string, url: string) {
    if (/\/api\/owner-covers\//.test(url))
      return this.localCover.verify(userId, url);
    if (!this.isOwnerApplicationCoverUrl(userId, url))
      throw new BadRequestException(
        'Ảnh bìa không thuộc hồ sơ của bạn. Vui lòng tải ảnh lại.',
      );
    const endpoint = this.config.get<string>('storage.endpoint');
    const accessKeyId = this.config.get<string>('storage.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.secretAccessKey');
    const bucket = this.config.get<string>('storage.publicBucket');
    const publicBaseUrl = this.config.get<string>('storage.publicBaseUrl');
    if (
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicBaseUrl
    )
      throw new ServiceUnavailableException('Chưa cấu hình kho ảnh công khai.');
    const key = url.slice(`${publicBaseUrl.replace(/\/$/, '')}/`.length);
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (
        !head.ContentLength ||
        head.ContentLength < 8 ||
        head.ContentLength > 10 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(
          head.ContentType ?? '',
        )
      )
        throw new BadRequestException(
          'Ảnh bìa không hợp lệ. Vui lòng chọn ảnh khác.',
        );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Ảnh bìa chưa được tải lên. Vui lòng thử lại.',
      );
    }
  }

  createOwnerCoverUploadUrl(
    key: string,
    contentType: string,
    sizeBytes: number,
  ) {
    const publicBucket = this.config.get<string>('storage.publicBucket');
    if (
      !publicBucket ||
      !this.config.get<string>('storage.endpoint') ||
      !this.config.get<string>('storage.publicBaseUrl')
    )
      return this.localCover.create(key, contentType, sizeBytes);
    return this.createUploadUrl(key, contentType, publicBucket);
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    targetBucket?: string,
  ) {
    const endpoint = this.config.get<string>('storage.endpoint');
    const accessKeyId = this.config.get<string>('storage.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.secretAccessKey');
    const bucket = targetBucket ?? this.config.get<string>('storage.bucket');
    const publicBaseUrl = this.config.get<string>('storage.publicBaseUrl');
    if (
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicBaseUrl
    ) {
      throw new ServiceUnavailableException(
        'Dịch vụ tải ảnh chưa được cấu hình. Vui lòng kiểm tra biến môi trường R2.',
      );
    }

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');

    return {
      uploadUrl,
      publicUrl: `${publicBaseUrl.replace(/\/$/, '')}/${encodedKey}`,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      contentType,
    };
  }
}
