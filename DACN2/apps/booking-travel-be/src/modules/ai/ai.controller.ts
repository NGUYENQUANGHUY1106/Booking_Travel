import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SmartSearchDto } from './dto/smart-search.dto';
import { SmartSearchService } from './smart-search.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly smartSearch: SmartSearchService) {}

  @Post('smart-search')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  search(@Body() input: SmartSearchDto) {
    return this.smartSearch.search(input);
  }
}
