import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const UPLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  async createUploadUrl(key: string, contentType: string) {
    const endpoint = this.config.get<string>('storage.endpoint');
    const accessKeyId = this.config.get<string>('storage.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.secretAccessKey');
    const bucket = this.config.get<string>('storage.bucket');
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
