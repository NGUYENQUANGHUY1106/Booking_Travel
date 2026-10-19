import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsUUID } from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ResendVerificationDto {
  @ApiProperty({ example: '9f5978d5-93bd-4199-8a09-27897f113abc' })
  @Transform(trimString)
  @IsUUID('4', { message: 'Phiên xác minh không đúng định dạng.' })
  verificationSessionId!: string;
}
