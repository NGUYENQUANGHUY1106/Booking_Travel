import { Hotel, HotelPolicy, HotelStatus } from '@prisma/client';

type Source = Pick<
  Hotel,
  | 'name'
  | 'accommodationType'
  | 'contactEmail'
  | 'contactPhone'
  | 'checkInTime'
  | 'checkOutTime'
  | 'addressLine'
  | 'provinceUnitId'
  | 'wardUnitId'
  | 'latitude'
  | 'longitude'
  | 'coverImageUrl'
  | 'status'
> & { policy: Pick<HotelPolicy, 'cancellationPolicy' | 'houseRules'> | null };

export function hotelSubmissionReadiness(
  hotel: Source,
  media: { isCover: boolean }[],
  activeRoomCount: number,
) {
  const completion = {
    basic: Boolean(hotel.name.trim() && hotel.accommodationType),
    contact:
      Boolean(hotel.contactEmail || hotel.contactPhone) &&
      Boolean(hotel.checkInTime && hotel.checkOutTime),
    location: Boolean(
      hotel.addressLine &&
      hotel.provinceUnitId &&
      hotel.wardUnitId &&
      hotel.latitude &&
      hotel.longitude,
    ),
    media: media.some((image) => image.isCover) || Boolean(hotel.coverImageUrl),
    policy: Boolean(
      hotel.policy?.cancellationPolicy || hotel.policy?.houseRules,
    ),
    rooms: activeRoomCount > 0,
  };
  const labels = {
    basic: ['Cơ bản', 'hotel-basic', 'Thêm tên và loại chỗ ở.'],
    contact: [
      'Liên hệ và giờ nhận/trả',
      'hotel-amenities',
      'Thêm liên hệ và giờ nhận/trả phòng.',
    ],
    location: [
      'Vị trí',
      'hotel-location',
      'Lưu địa chỉ hành chính và ghim vị trí hợp lệ.',
    ],
    media: ['Ảnh bìa', 'hotel-media', 'Hoàn tất tải ảnh bìa chỗ ở.'],
    policy: [
      'Chính sách',
      'hotel-amenities',
      'Thêm chính sách hủy hoặc nội quy.',
    ],
    rooms: [
      'Hạng phòng',
      'rooms',
      'Tạo ít nhất một hạng phòng đang hoạt động.',
    ],
  } as const;
  const checklist = (
    Object.keys(completion) as (keyof typeof completion)[]
  ).map((code) => ({
    code,
    label: labels[code][0],
    targetStep: labels[code][1],
    complete: completion[code],
    reason: completion[code] ? null : labels[code][2],
    required: true,
  }));
  const readyForReview = checklist.every((item) => item.complete);
  const canSubmit =
    readyForReview &&
    (hotel.status === HotelStatus.DRAFT ||
      hotel.status === HotelStatus.REJECTED);
  return { completion, checklist, readyForReview, canSubmit };
}
