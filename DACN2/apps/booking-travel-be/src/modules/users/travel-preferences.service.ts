import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AccommodationPreferenceType,
  TravelAmenityPreference,
  TravelAreaPreference,
  TravelTripType,
  type UserPreference,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateTravelPreferencesDto } from './dto/update-travel-preferences.dto';

const EMPTY_PREFERENCES = {
  budgetMin: null,
  budgetMax: null,
  currency: 'VND',
  accommodationTypes: [] as AccommodationPreferenceType[],
  tripTypes: [] as TravelTripType[],
  preferredAmenities: [] as TravelAmenityPreference[],
  preferredAreas: [] as TravelAreaPreference[],
};

@Injectable()
export class TravelPreferencesService {
  private readonly logger = new Logger(TravelPreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const preference = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    return preference ? this.toResponse(preference) : this.emptyResponse();
  }

  async update(userId: string, input: UpdateTravelPreferencesDto) {
    if (
      input.budgetMin != null &&
      input.budgetMax != null &&
      input.budgetMin > input.budgetMax
    ) {
      throw new BadRequestException(
        'Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.',
      );
    }

    const data = {
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      currency: input.currency,
      accommodationTypes: this.unique(input.accommodationTypes),
      tripTypes: this.unique(input.tripTypes),
      preferredAmenities: this.unique(input.preferredAmenities),
      preferredAreas: this.unique(input.preferredAreas),
    };
    const preference = await this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        budgetMin: input.budgetMin ?? null,
        budgetMax: input.budgetMax ?? null,
        currency: input.currency ?? 'VND',
        accommodationTypes: data.accommodationTypes ?? [],
        tripTypes: data.tripTypes ?? [],
        preferredAmenities: data.preferredAmenities ?? [],
        preferredAreas: data.preferredAreas ?? [],
      },
      update: data,
    });
    this.publishRecommendationEvent(userId, preference.updatedAt, 'UPDATED');

    return this.toResponse(preference);
  }

  async reset(userId: string) {
    await this.prisma.userPreference.deleteMany({ where: { userId } });
    const occurredAt = new Date();
    this.publishRecommendationEvent(userId, occurredAt, 'RESET');

    return this.emptyResponse(occurredAt);
  }

  private unique<T>(values: T[] | undefined) {
    return values ? [...new Set(values)] : undefined;
  }

  private toResponse(preference: UserPreference) {
    return {
      budgetMin: preference.budgetMin,
      budgetMax: preference.budgetMax,
      currency: preference.currency,
      accommodationTypes: preference.accommodationTypes,
      tripTypes: preference.tripTypes,
      preferredAmenities: preference.preferredAmenities,
      preferredAreas: preference.preferredAreas,
      updatedAt: preference.updatedAt,
    };
  }

  private emptyResponse(updatedAt: Date | null = null) {
    return { ...EMPTY_PREFERENCES, updatedAt };
  }

  private publishRecommendationEvent(
    userId: string,
    occurredAt: Date,
    action: 'UPDATED' | 'RESET',
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'recommendation.user-preferences.changed',
        userId,
        action,
        occurredAt: occurredAt.toISOString(),
      }),
    );
  }
}
