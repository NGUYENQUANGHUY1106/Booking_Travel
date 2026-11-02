import { Controller, Get, Param, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HotelMediaService } from './hotel-media.service';

@Controller('hotel-media')
export class HotelMediaController {
  constructor(private readonly media: HotelMediaService) {}

  @Put(':id/content')
  async upload(
    @Param('id') id: string,
    @Query('e') expires: string,
    @Query('s') signature: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    await this.media.putLocal(id, expires, signature, request);
    response.status(204).send();
  }

  @Get(':id/content')
  async read(
    @Param('id') id: string,
    @Query('e') expires: string,
    @Query('s') signature: string,
    @Res() response: Response,
  ) {
    const image = await this.media.read(id, expires, signature);
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.send(image.bytes);
  }
}
