import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('hotels/:hotelId/rooms')
  listByHotel(@Param('hotelId') hotelId: string) {
    return this.rooms.listByHotel(hotelId);
  }

  @Get('rooms/:id')
  get(@Param('id') id: string) {
    return this.rooms.get(id);
  }

  // ST-AUTH-08: endpoint tạm thời mở; ownerId sẽ lấy từ JWT khi tích hợp phân quyền.
  @Post('hotels/:hotelId/rooms')
  create(@Param('hotelId') hotelId: string, @Body() input: CreateRoomDto) {
    return this.rooms.create(hotelId, input);
  }

  @Patch('rooms/:id')
  update(@Param('id') id: string, @Body() input: UpdateRoomDto) {
    return this.rooms.update(id, input);
  }

  @Delete('rooms/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.rooms.remove(id);
  }
}
