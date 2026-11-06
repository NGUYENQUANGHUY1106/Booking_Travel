import { Controller, Get, Param, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OwnerCoverLocalService } from '../../infrastructure/storage/owner-cover-local.service';

@Controller('owner-covers')
export class OwnerCoverController {
  constructor(private readonly covers: OwnerCoverLocalService) {}

  @Put(':id/content')
  async upload(
    @Param('id') id: string,
    @Query('e') e: string,
    @Query('u') u: string,
    @Query('m') m: string,
    @Query('z') z: string,
    @Query('s') s: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    await this.covers.put(id, { e, u, m, z, s }, request);
    response.status(204).send();
  }

  @Get(':id/content')
  async read(@Param('id') id: string, @Res() response: Response) {
    const cover = await this.covers.read(id);
    response.setHeader('Content-Type', cover.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.send(cover.image);
  }
}
