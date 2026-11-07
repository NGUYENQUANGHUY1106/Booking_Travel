import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Request } from 'express';

const MAX_BYTES = 10 * 1024 * 1024;
const TTL_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CoverMetadata = { userId: string; mimeType: string; sizeBytes: number };

function matchesImage(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    );
  return (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  );
}

@Injectable()
export class OwnerCoverLocalService {
  private readonly directory = resolve(
    process.env.LOCAL_MEDIA_DIR ?? '../../.local-media',
    'owner-covers',
  );
  constructor(private readonly config: ConfigService) {}

  private secret() {
    const value = this.config.get<string>('auth.accessSecret');
    if (!value)
      throw new ServiceUnavailableException(
        'Chưa cấu hình khóa ký URL tải ảnh.',
      );
    return value;
  }

  private path(id: string) {
    if (!UUID.test(id))
      throw new BadRequestException('Mã ảnh bìa không hợp lệ.');
    return resolve(this.directory, id);
  }

  private sign(
    id: string,
    userId: string,
    mimeType: string,
    sizeBytes: number,
    expires: number,
  ) {
    return createHmac('sha256', this.secret())
      .update(`${id}:${userId}:${mimeType}:${sizeBytes}:${expires}`)
      .digest('hex');
  }

  create(key: string, mimeType: string, sizeBytes: number) {
    if (this.config.get<string>('app.environment') === 'production')
      throw new ServiceUnavailableException(
        'Kho ảnh công khai chưa được cấu hình.',
      );
    const match =
      /^owner-applications\/([a-z0-9_-]+)\/([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(
        key,
      );
    if (
      !match ||
      !UUID.test(match[2]) ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 8 ||
      sizeBytes > MAX_BYTES
    )
      throw new BadRequestException('Ảnh bìa không hợp lệ.');
    const [, userId, id] = match;
    const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const signature = this.sign(id, userId, mimeType, sizeBytes, expires);
    const publicUrl = `/api/owner-covers/${id}/content`;
    return {
      uploadUrl: `${publicUrl}?e=${expires}&u=${encodeURIComponent(userId)}&m=${encodeURIComponent(mimeType)}&z=${sizeBytes}&s=${signature}`,
      publicUrl,
      expiresIn: TTL_SECONDS,
      contentType: mimeType,
    };
  }

  async put(
    id: string,
    query: { e: string; u: string; m: string; z: string; s: string },
    request: Request,
  ) {
    this.path(id);
    const expires = Number(query.e);
    const sizeBytes = Number(query.z);
    if (
      !Number.isSafeInteger(expires) ||
      expires < Math.floor(Date.now() / 1000) ||
      expires > Math.floor(Date.now() / 1000) + TTL_SECONDS + 60
    )
      throw new ForbiddenException('Liên kết tải ảnh đã hết hạn.');
    if (
      !Number.isSafeInteger(sizeBytes) ||
      sizeBytes < 8 ||
      sizeBytes > MAX_BYTES ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(query.m)
    )
      throw new BadRequestException('Ảnh bìa không hợp lệ.');
    const expected = Buffer.from(
      this.sign(id, query.u, query.m, sizeBytes, expires),
      'hex',
    );
    const actual = /^[0-9a-f]{64}$/i.test(query.s)
      ? Buffer.from(query.s, 'hex')
      : Buffer.alloc(0);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new ForbiddenException('Liên kết tải ảnh không hợp lệ.');
    if (
      request.headers['content-type']?.split(';')[0].toLowerCase() !== query.m
    )
      throw new BadRequestException('Định dạng ảnh không khớp.');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      total += bytes.length;
      if (total > sizeBytes)
        throw new BadRequestException('Ảnh vượt dung lượng đã khai báo.');
      chunks.push(bytes);
    }
    const image = Buffer.concat(chunks);
    if (total !== sizeBytes || !matchesImage(image, query.m))
      throw new BadRequestException('Nội dung ảnh không hợp lệ.');
    await mkdir(this.directory, { recursive: true });
    let imageWritten = false;
    try {
      await writeFile(this.path(id), image, { flag: 'wx' });
      imageWritten = true;
      await writeFile(
        `${this.path(id)}.json`,
        JSON.stringify({
          userId: query.u,
          mimeType: query.m,
          sizeBytes,
        } satisfies CoverMetadata),
        { flag: 'wx' },
      );
    } catch {
      if (imageWritten) await unlink(this.path(id)).catch(() => undefined);
      throw new ConflictException(
        'Ảnh đã được tải lên hoặc không thể lưu. Vui lòng chọn lại ảnh.',
      );
    }
  }

  private async load(id: string) {
    const path = this.path(id);
    try {
      const metadata = JSON.parse(
        await readFile(`${path}.json`, 'utf8'),
      ) as CoverMetadata;
      const image = await readFile(path);
      if (
        image.length !== metadata.sizeBytes ||
        !matchesImage(image, metadata.mimeType)
      )
        throw new Error('invalid');
      return { metadata, image };
    } catch {
      throw new NotFoundException('Không tìm thấy ảnh bìa.');
    }
  }

  async read(id: string) {
    const { metadata, image } = await this.load(id);
    return { mimeType: metadata.mimeType, image };
  }

  async verify(userId: string, url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('URL ảnh bìa không hợp lệ.');
    }
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!apiBase || parsed.origin !== new URL(apiBase).origin)
      throw new BadRequestException('Ảnh bìa không thuộc máy chủ này.');
    const match = /^\/api\/owner-covers\/([0-9a-f-]{36})\/content$/i.exec(
      parsed.pathname,
    );
    if (!match || parsed.search)
      throw new BadRequestException('URL ảnh bìa không hợp lệ.');
    const { metadata } = await this.load(match[1]);
    if (metadata.userId !== userId)
      throw new ForbiddenException('Ảnh bìa không thuộc hồ sơ của bạn.');
  }
}
