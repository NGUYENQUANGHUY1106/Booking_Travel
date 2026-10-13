import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AddressCatalogController } from './address-catalog.controller';
import { AddressCatalogService } from './address-catalog.service';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';

@Module({
  imports: [AuthModule],
  controllers: [AddressCatalogController, AddressController],
  providers: [AddressCatalogService, AddressService],
  exports: [AddressCatalogService],
})
export class AddressesModule {}
