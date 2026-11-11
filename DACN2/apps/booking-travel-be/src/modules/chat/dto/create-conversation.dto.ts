import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  hotelId!: string;
}
