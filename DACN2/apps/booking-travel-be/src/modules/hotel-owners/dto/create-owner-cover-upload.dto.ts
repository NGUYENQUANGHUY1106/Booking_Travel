import { IsIn, IsInt, Max, Min } from 'class-validator';

export const OWNER_COVER_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateOwnerCoverUploadDto {
  @IsIn(OWNER_COVER_CONTENT_TYPES)
  contentType!: (typeof OWNER_COVER_CONTENT_TYPES)[number];

  @IsInt()
  @Min(8)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}
