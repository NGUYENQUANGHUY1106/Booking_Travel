import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './infrastructure/database/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  welcome(): { name: string; message: string } {
    return {
      name: 'Booking Travel API',
      message: 'Welcome! The API skeleton is running.',
    };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('health/database')
  async databaseHealth(): Promise<{ status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
