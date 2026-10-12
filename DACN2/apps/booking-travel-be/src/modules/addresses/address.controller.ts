import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Saved addresses')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly addresses: AddressService) {}

  @Get()
  list(@CurrentUserId() ownerId: string) {
    return this.addresses.list(ownerId);
  }

  @Get(':id')
  get(@CurrentUserId() ownerId: string, @Param('id') id: string) {
    return this.addresses.get(ownerId, id);
  }

  @Post()
  create(@CurrentUserId() ownerId: string, @Body() input: CreateAddressDto) {
    return this.addresses.create(ownerId, input);
  }

  @Patch(':id')
  update(
    @CurrentUserId() ownerId: string,
    @Param('id') id: string,
    @Body() input: UpdateAddressDto,
  ) {
    return this.addresses.update(ownerId, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUserId() ownerId: string, @Param('id') id: string) {
    return this.addresses.remove(ownerId, id);
  }

  @Patch(':id/default')
  setDefault(@CurrentUserId() ownerId: string, @Param('id') id: string) {
    return this.addresses.setDefault(ownerId, id);
  }
}
