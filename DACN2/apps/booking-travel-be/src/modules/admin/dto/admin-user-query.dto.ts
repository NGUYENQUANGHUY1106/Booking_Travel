import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserQueryDto {
  @ApiPropertyOptional({ description: 'Tên, email hoặc số điện thoại' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: [UserRole.USER, UserRole.HOTEL_OWNER] })
  @IsOptional()
  @IsIn([UserRole.USER, UserRole.HOTEL_OWNER])
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @ApiPropertyOptional({
    enum: ['createdAt', 'fullName', 'email', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'fullName', 'email', 'status'])
  sortBy: 'createdAt' | 'fullName' | 'email' | 'status' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
