import { OwnerDocumentPurpose } from '@prisma/client';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';
import {
  OWNER_DOCUMENT_MAX_BYTES,
  OWNER_DOCUMENT_MIN_BYTES,
} from '../../../infrastructure/storage/private-media.service';

export class PresignOwnerDocumentDto {
  @IsEnum(OwnerDocumentPurpose)
  purpose!: OwnerDocumentPurpose;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(OWNER_DOCUMENT_MIN_BYTES)
  @Max(OWNER_DOCUMENT_MAX_BYTES)
  sizeBytes!: number;
}
