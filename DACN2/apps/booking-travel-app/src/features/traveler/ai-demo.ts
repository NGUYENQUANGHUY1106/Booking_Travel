import type { Hotel } from './data';

const KNOWN_DESTINATIONS = ['Đà Nẵng', 'Hội An', 'Nha Trang', 'Phú Quốc', 'Hà Nội'];
const normalize = (value: string) => value.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

export function suggestHotel(hotels: readonly Hotel[], question: string, currentDestination: string): Hotel | undefined {
  const text = normalize(question);
  const mentionedDestination = KNOWN_DESTINATIONS.find((destination) => text.includes(normalize(destination)));
  const destination = mentionedDestination ?? currentDestination;
  const budget = text.match(/(?:duoi|toi da|khoang|ngan sach)\s*(\d+(?:[.,]\d+)?)\s*trieu/);
  const budgetThousands = text.match(/(?:duoi|toi da|khoang|ngan sach)\s*(\d+)\s*(?:nghin|k)\b/);
  const maxPrice = budget ? Number(budget[1].replace(',', '.')) * 1000000 : budgetThousands ? Number(budgetThousands[1]) * 1000 : Infinity;
  const wantsPool = text.includes('ho boi') || text.includes('pool');
  const wantsNearBeach = text.includes('gan bien');
  const matches = hotels.filter((hotel) => normalize(hotel.destination) === normalize(destination) && hotel.price <= maxPrice && (!wantsPool || hotel.amenities.includes('Hồ bơi')) && (!wantsNearBeach || hotel.distanceMeters <= 1000));
  matches.sort((a, b) => b.rating - a.rating || a.price - b.price);
  return matches[0];
}
