import { IsDateString } from 'class-validator';

export class RoomAvailabilityQueryDto {
  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;
}
