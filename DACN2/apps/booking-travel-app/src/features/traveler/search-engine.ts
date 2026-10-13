import type { Hotel } from './data';
import type { SearchFilters, SortKey } from './store';

export function searchHotels(hotels: readonly Hotel[], destination: string, filters: SearchFilters, sort: SortKey): Hotel[] {
  const query = destination.trim().toLocaleLowerCase('vi-VN');
  const matches = hotels.filter((hotel) =>
    (!query || hotel.destination.toLocaleLowerCase('vi-VN').includes(query) || hotel.area.toLocaleLowerCase('vi-VN').includes(query))
    && (!filters.types.length || filters.types.includes(hotel.type))
    && hotel.price >= filters.minPrice && hotel.price <= filters.maxPrice
    && (!filters.stars.length || filters.stars.includes(Math.round(hotel.rating / 2)))
    && hotel.rating >= filters.minRating
    && filters.amenities.every((amenity) => hotel.amenities.includes(amenity))
    && (!filters.freeCancellation || hotel.amenities.includes('Hủy miễn phí')),
  );

  if (sort === 'priceAsc' || sort === 'deals') matches.sort((a, b) => a.price - b.price);
  if (sort === 'priceDesc') matches.sort((a, b) => b.price - a.price);
  if (sort === 'rating') matches.sort((a, b) => b.rating - a.rating);
  if (sort === 'popular') matches.sort((a, b) => b.reviews - a.reviews);
  if (sort === 'nearest') matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return matches;
}
