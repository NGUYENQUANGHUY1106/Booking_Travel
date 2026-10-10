import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AddressCatalogService } from './address-catalog.service';
import {
  CatalogModeQueryDto,
  SearchCatalogQueryDto,
  StreetSearchQueryDto,
} from './dto/catalog-query.dto';
import { ValidateAddressDto } from './dto/validate-address.dto';

@ApiTags('Address catalog')
@Controller('addresses/catalog')
export class AddressCatalogController {
  constructor(private readonly catalog: AddressCatalogService) {}

  @Get('provinces')
  provinces(@Query() query: CatalogModeQueryDto) {
    return this.catalog.listProvinces(query.mode);
  }

  @Get('provinces/:provinceId/communes')
  currentCommunes(@Param('provinceId') provinceId: string) {
    return this.catalog.listCurrentCommunes(provinceId);
  }

  @Get('legacy/provinces/:provinceId/districts')
  legacyDistricts(@Param('provinceId') provinceId: string) {
    return this.catalog.listLegacyDistricts(provinceId);
  }

  @Get('legacy/districts/:districtId/communes')
  legacyCommunes(@Param('districtId') districtId: string) {
    return this.catalog.listLegacyCommunes(districtId);
  }

  @Get('search')
  search(@Query() query: SearchCatalogQueryDto) {
    return this.catalog.search(query);
  }

  @Get('streets')
  streets(@Query() query: StreetSearchQueryDto) {
    return this.catalog.searchStreets(query);
  }

  @Get('transitions/:unitId')
  transitions(@Param('unitId') unitId: string) {
    return this.catalog.getTransitions(unitId);
  }

  @Post('validate')
  @HttpCode(200)
  validate(@Body() input: ValidateAddressDto) {
    return this.catalog.validate(input);
  }
}
