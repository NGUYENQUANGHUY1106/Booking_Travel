import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AssistantService } from './assistant.service';
import { AssistantMessageDto } from './dto/assistant-message.dto';
import { SmartSearchDto } from './dto/smart-search.dto';
import { SmartSearchService } from './smart-search.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly smartSearch: SmartSearchService,
    private readonly assistant: AssistantService,
  ) {}

  @Post('smart-search')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  search(@Body() input: SmartSearchDto) {
    return this.smartSearch.search(input);
  }

  @Post('assistant/messages')
  @Public()
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  message(
    @Body() input: AssistantMessageDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.assistant.message(input, user);
  }
}
