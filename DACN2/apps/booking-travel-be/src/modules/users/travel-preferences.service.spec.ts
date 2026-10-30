import { BadRequestException, Logger } from '@nestjs/common';
import {
  AccommodationPreferenceType,
  Prisma,
  TravelAmenityPreference,
  TravelAreaPreference,
  TravelTripType,
  type UserPreference,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TravelPreferencesService } from './travel-preferences.service';

describe('TravelPreferencesService', () => {
  const now = new Date('2026-10-30T10:00:00.000Z');
  const savedPreference: UserPreference = {
    id: 'preference-1',
    userId: 'user-1',
    budgetMin: 500_000,
    budgetMax: 3_000_000,
    currency: 'VND',
    accommodationTypes: [AccommodationPreferenceType.HOTEL],
    tripTypes: [TravelTripType.FAMILY],
    preferredAmenities: [TravelAmenityPreference.BREAKFAST],
    preferredAreas: [TravelAreaPreference.BEACHFRONT],
    createdAt: now,
    updatedAt: now,
  };
  const findUnique = jest.fn<
    Promise<UserPreference | null>,
    [Prisma.UserPreferenceFindUniqueArgs]
  >();
  const upsert = jest.fn<
    Promise<UserPreference>,
    [Prisma.UserPreferenceUpsertArgs]
  >();
  const deleteMany = jest.fn<
    Promise<Prisma.BatchPayload>,
    [Prisma.UserPreferenceDeleteManyArgs]
  >();
  const prisma = {
    userPreference: { findUnique, upsert, deleteMany },
  } as unknown as PrismaService;
  const service = new TravelPreferencesService(prisma);

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns an empty profile when the user has not configured preferences', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.get('user-1')).resolves.toEqual({
      budgetMin: null,
      budgetMax: null,
      currency: 'VND',
      accommodationTypes: [],
      tripTypes: [],
      preferredAmenities: [],
      preferredAreas: [],
      updatedAt: null,
    });
  });

  it('rejects an invalid budget range', async () => {
    await expect(
      service.update('user-1', { budgetMin: 4_000_000, budgetMax: 2_000_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('normalizes duplicate enum selections before saving', async () => {
    upsert.mockResolvedValue(savedPreference);

    await service.update('user-1', {
      accommodationTypes: [
        AccommodationPreferenceType.HOTEL,
        AccommodationPreferenceType.HOTEL,
      ],
      tripTypes: [TravelTripType.FAMILY],
    });

    const input = upsert.mock.calls[0]?.[0];
    expect(input?.where).toEqual({ userId: 'user-1' });
    expect(input?.update).toMatchObject({
      accommodationTypes: [AccommodationPreferenceType.HOTEL],
      tripTypes: [TravelTripType.FAMILY],
    });
  });

  it('resets the saved preference idempotently', async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.reset('user-1');

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(result).toMatchObject({
      budgetMin: null,
      accommodationTypes: [],
      preferredAmenities: [],
    });
  });
});
