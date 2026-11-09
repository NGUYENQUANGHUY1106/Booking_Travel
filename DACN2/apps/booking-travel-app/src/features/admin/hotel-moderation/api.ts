import { apiClient } from '@/services/api-client';

export type AccommodationType = 'HOTEL' | 'RESORT' | 'APARTMENT' | 'VILLA' | 'HOMESTAY' | 'HOSTEL';
export const ACCOMMODATION_LABELS: Record<AccommodationType, string> = {
  HOTEL: 'Khách sạn', RESORT: 'Resort', APARTMENT: 'Căn hộ',
  VILLA: 'Villa', HOMESTAY: 'Homestay', HOSTEL: 'Hostel',
};

export type HotelReviewQuery = {
  search?: string;
  types?: AccommodationType[];
  page: number;
  limit: number;
  sort: 'newest' | 'oldest';
};

export type HotelReviewItem = {
  id: string;
  hotelId: string;
  version: number;
  status: 'PENDING';
  submittedAt: string;
  name: string;
  accommodationType: AccommodationType;
  address: string;
  roomTypeCount: number;
  coverImageUrl: string | null;
  owner: { id: string; fullName: string; email: string | null };
};

export type HotelReviewPage = { items: HotelReviewItem[]; total: number; page: number; limit: number };
export type HotelReviewMedia = { id: string; roomId: string | null; url: string; isCover: boolean; sortOrder: number };
export type HotelReviewRoom = {
  id: string; name: string; type: string; description?: string | null;
  capacityAdults: number; capacityChildren: number; bedInfo: string;
  classCode?: string | null; viewCode?: string | null; bedConfigurations?: unknown;
  areaM2?: string | null; quantity: number; basePrice: string; currency: string;
  amenities?: string[]; media?: { id: string }[];
};
export type HotelReviewSnapshot = {
  name: string; accommodationType: AccommodationType; description?: string | null;
  addressLine?: string | null; province?: string | null; district?: string | null; ward?: string | null;
  latitude?: string | null; longitude?: string | null;
  contactEmail?: string | null; contactPhone?: string | null;
  checkInTime?: string | null; checkOutTime?: string | null;
  coverId?: string | null; mediaIds?: string[];
  amenities?: { id: string; name: string }[]; amenityIds?: string[];
  policy?: { cancellationPolicy?: string | null; houseRules?: string | null } | null;
  checklist?: { code: string; label: string; complete: boolean; required: boolean }[];
  rooms?: HotelReviewRoom[];
};
export type HotelReviewDetail = {
  id: string; hotelId: string; version: number; status: 'PENDING'; submittedAt: string;
  snapshot: HotelReviewSnapshot;
  hotel: { status: string; profileVersion: number; owner: {
    id: string; fullName: string; email: string | null; phone: string | null;
    ownerApplication: { status: string } | null; ownerProfile: { isActive: boolean } | null;
  } };
  media: HotelReviewMedia[];
  evidence: { canApprove: boolean; missing: string[] };
};
export type HotelDecision = 'APPROVE' | 'REJECT';

export const hotelReviewApi = {
  async list(query: HotelReviewQuery) {
    const params = {
      status: 'PENDING', page: query.page, limit: query.limit, sort: query.sort,
      ...(query.search ? { search: query.search } : {}),
      ...(query.types?.length ? { types: query.types.join(',') } : {}),
    };
    return (await apiClient.get<HotelReviewPage>('/hotels/review/submissions', { params })).data;
  },
  async detail(id: string) {
    return (await apiClient.get<HotelReviewDetail>(`/hotels/review/submissions/${encodeURIComponent(id)}`)).data;
  },
  async decide(id: string, input: { decision: HotelDecision; expectedVersion: number; reason?: string; requestId: string }) {
    return (await apiClient.post(`/hotels/review/submissions/${encodeURIComponent(id)}/decision`, input)).data;
  },
};
