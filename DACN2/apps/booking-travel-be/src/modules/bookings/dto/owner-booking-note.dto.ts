import { IsString, MaxLength } from 'class-validator';

export class OwnerBookingNoteDto {
  @IsString()
  @MaxLength(1000)
  note!: string;
}
