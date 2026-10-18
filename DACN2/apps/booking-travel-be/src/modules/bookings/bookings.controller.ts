import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // ST-AUTH-08: userId/hotelId là tham số dev; sẽ lấy từ JWT sau khi tích hợp phân quyền.
  @Get()
  list(@Query() query: BookingQueryDto) {
    return this.bookings.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bookings.get(id);
  }

  @Post()
  create(@Body() input: CreateBookingDto) {
    return this.bookings.create(input);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() input: UpdateBookingStatusDto) {
    return this.bookings.updateStatus(id, input);
  }
}
