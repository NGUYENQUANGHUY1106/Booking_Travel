import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsString, Length } from 'class-validator';

export class InitializePaymentDto {
  @IsString()
  @Length(1, 120)
  bookingId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
