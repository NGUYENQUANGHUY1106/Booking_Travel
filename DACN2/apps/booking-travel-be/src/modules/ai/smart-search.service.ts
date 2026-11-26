import { BadRequestException, Injectable } from '@nestjs/common';
import { HotelsService } from '../hotels/hotels.service';
import { SmartSearchDto } from './dto/smart-search.dto';
import {
  matchesSmartSearchFeature,
  normalizeSmartSearchLocation,
  normalizeSmartSearchText,
  parseSmartSearchIntent,
  smartSearchChips,
  type SmartSearchHotel,
} from './smart-search.intent';

@Injectable()
export class SmartSearchService {
  constructor(private readonly hotels: HotelsService) {}

  async search(input: SmartSearchDto) {
    if (Boolean(input.checkIn) !== Boolean(input.checkOut)) {
      throw new BadRequestException(
        'Cần cả ngày nhận và trả phòng để tìm theo thời gian lưu trú.',
      );
    }

    const publicHotels = await this.hotels.list({});
    const intent = parseSmartSearchIntent(
      input.query,
      publicHotels,
      input.destination,
    );
    const chips = smartSearchChips(intent);
    const destinationSuggestions = [
      ...new Set(
        publicHotels
          .flatMap((hotel) => [hotel.city, hotel.province])
          .filter((value): value is string => Boolean(value?.trim())),
      ),
    ].slice(0, 5);

    if (intent.confidence < 0.5) {
      return {
        status: 'UNSUPPORTED_QUERY' as const,
        message:
          'Tôi được cấu hình để tìm kiếm những khách sạn phù hợp cho bạn. Nội dung này nằm ngoài hiểu biết của tôi. Xin cảm ơn.',
        intent,
        chips,
        destinationSuggestions,
        items: [],
        pagination: { total: 0, limit: input.limit ?? 10 },
      };
    }

    if (!intent.destination) {
      return {
        status: 'NEEDS_DESTINATION' as const,
        message: 'Bạn muốn tìm khách sạn ở đâu?',
        intent,
        chips,
        destinationSuggestions,
        items: [],
        pagination: { total: 0, limit: input.limit ?? 10 },
      };
    }

    const base =
      input.checkIn && input.checkOut
        ? (
            await this.hotels.search({
              destination: intent.destination,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              adults: input.adults ?? 1,
              children: input.children ?? 0,
              rooms: input.rooms ?? 1,
              minPrice: intent.minPrice ?? undefined,
              maxPrice: intent.maxPrice ?? undefined,
              stars: intent.stars.length ? intent.stars : undefined,
              propertyTypes: intent.propertyTypes.length
                ? intent.propertyTypes
                : undefined,
              amenities: intent.amenities.length ? intent.amenities : undefined,
              freeCancellation: intent.freeCancellation || undefined,
              page: 1,
              limit: 50,
            })
          ).items
        : publicHotels;
    const destination = normalizeSmartSearchLocation(intent.destination);
    const filtered = (base as SmartSearchHotel[]).filter((hotel) => {
      const locations = [
        hotel.name,
        hotel.addressLine,
        hotel.city,
        hotel.district,
        hotel.ward,
        hotel.province,
      ]
        .filter((value): value is string => Boolean(value))
        .map(normalizeSmartSearchLocation);
      const price = hotel.minPricePerNight
        ? Number(hotel.minPricePerNight)
        : null;
      const hotelAmenities = new Set(
        hotel.amenities.map((amenity) =>
          normalizeSmartSearchText(amenity.name),
        ),
      );
      return (
        locations.some((location) => location.includes(destination)) &&
        (!intent.stars.length || intent.stars.includes(hotel.starRating)) &&
        (intent.minPrice === null ||
          (price !== null && price >= intent.minPrice)) &&
        (intent.maxPrice === null ||
          (price !== null && price <= intent.maxPrice)) &&
        (!intent.propertyTypes.length ||
          (hotel.accommodationType !== null &&
            hotel.accommodationType !== undefined &&
            intent.propertyTypes.includes(hotel.accommodationType))) &&
        intent.amenities.every((amenity) =>
          hotelAmenities.has(normalizeSmartSearchText(amenity)),
        ) &&
        (!intent.freeCancellation || hotel.freeCancellation) &&
        intent.features.every((feature) =>
          matchesSmartSearchFeature(hotel, feature),
        )
      );
    });
    const limit = input.limit ?? 10;

    return {
      status: filtered.length ? ('RESULTS' as const) : ('NO_MATCH' as const),
      message: filtered.length
        ? `Đã tìm thấy ${filtered.length} khách sạn phù hợp từ dữ liệu hệ thống.`
        : 'Chưa tìm thấy khách sạn phù hợp. Bạn có thể bỏ bớt một điều kiện.',
      intent,
      chips,
      destinationSuggestions,
      items: filtered.slice(0, limit),
      pagination: { total: filtered.length, limit },
    };
  }
}
