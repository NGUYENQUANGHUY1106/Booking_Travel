import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './infrastructure/database/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('welcome', () => {
    it('returns the skeleton welcome payload', () => {
      expect(appController.welcome()).toEqual({
        name: 'Booking Travel API',
        message: 'Welcome! The API skeleton is running.',
      });
    });
  });
});
