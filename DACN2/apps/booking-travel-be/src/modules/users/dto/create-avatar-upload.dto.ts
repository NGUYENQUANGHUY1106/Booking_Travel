import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export const AVATAR_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateAvatarUploadDto {
  @ApiProperty({ example: 'avatar.jpg' })
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ enum: AVATAR_CONTENT_TYPES, example: 'image/jpeg' })
  @IsIn(AVATAR_CONTENT_TYPES, {
    message: 'Ảnh đại diện chỉ hỗ trợ JPEG, PNG hoặc WebP.',
  })
  contentType!: (typeof AVATAR_CONTENT_TYPES)[number];

  @ApiProperty({ example: 524288 })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024, {
    message: 'Ảnh đại diện không được vượt quá 5 MB.',
  })
  sizeBytes!: number;
}
