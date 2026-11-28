import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ReviewsModule } from './reviews.module';

describe('ReviewsModule', () => {
  it('resolves review controllers and authentication guards', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ auth: { accessSecret: 'test-secret' } })],
        }),
        DatabaseModule,
        ReviewsModule,
      ],
    }).compile();
    await module.close();
  });
});
