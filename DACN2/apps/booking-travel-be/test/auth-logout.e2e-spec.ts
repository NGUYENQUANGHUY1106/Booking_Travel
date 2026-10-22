import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { AuthModule } from '../src/modules/auth/auth.module';

describe('ST-AUTH-06 logout request pipeline', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const authSessionUpdateMany = jest.fn();
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        role: UserRole.USER,
        isActive: true,
        adminProfile: null,
      }),
    },
    authSession: { updateMany: authSessionUpdateMany },
  };

  beforeAll(async () => {
    process.env.SKIP_DATABASE_CONNECT = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              auth: {
                accessSecret: 'test-access-secret',
                refreshSecret: 'test-refresh-secret',
              },
            }),
          ],
        }),
        DatabaseModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authSessionUpdateMany.mockResolvedValue({ count: 1 });
  });

  const bearer = (sessionId = 'session-1') =>
    `Bearer ${jwt.sign({ sub: 'user-1', sessionId })}`;

  it('revokes the session identified by the access token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', bearer())
      .expect(200);

    const body = response.body as {
      scope: string;
      revokedSessionCount: number;
    };
    expect(body).toMatchObject({
      scope: 'CURRENT',
      revokedSessionCount: 1,
    });
    expect(authSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'session-1',
          userId: 'user-1',
          revokedAt: null,
        },
      }),
    );
  });

  it('revokes all sessions only for the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', bearer())
      .send({ allSessions: true })
      .expect(200);
    const body = response.body as { scope: string };
    expect(body).toMatchObject({ scope: 'ALL' });

    expect(authSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      }),
    );
  });

  it('rejects missing credentials, missing session claims, and invalid input', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 'user-1' })}`)
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', bearer())
      .send({ allSessions: 'true' })
      .expect(400);

    expect(authSessionUpdateMany).not.toHaveBeenCalled();
  });
});
