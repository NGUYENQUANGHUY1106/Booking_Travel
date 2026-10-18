import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelQueryDto } from './dto/hotel-query.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { HotelsService } from './hotels.service';

@ApiTags('Hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Get()
  list(@Query() query: HotelQueryDto) {
    return this.hotels.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.hotels.get(id);
  }

  // ST-AUTH-08: endpoint tạm thời mở để hai thành viên tích hợp; bổ sung guard/RBAC trước production.
  @Post()
  create(@Body() input: CreateHotelDto) {
    return this.hotels.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateHotelDto) {
    return this.hotels.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.hotels.remove(id);
  }
}
