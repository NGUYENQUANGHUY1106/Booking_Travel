import { apiClient } from '@/services/api-client';

export type RestrictionAction = 'HIDE' | 'SUSPEND' | 'RESTORE';
export type ManagedHotel = {
  id: string; name: string; status: string; isVisible: boolean;
  restrictionVersion: number; profileVersion: number;
  accommodationType: string | null; addressLine: string | null;
  province: string | null; city: string | null; updatedAt: string;
  owner: { id: string; fullName: string; email: string | null; phone: string | null };
  roomCount: number; futureBookingCount: number; coverImageUrl: string | null;
};
export type ManagedHotelDetail = Omit<ManagedHotel, 'roomCount'> & {
  description: string | null; contactEmail: string | null; contactPhone: string | null;
  policy: { cancellationPolicy: string | null; houseRules: string | null } | null;
  amenities: string[];
  gallery: { id: string; url: string; isCover: boolean }[];
  rooms: { id: string; name: string; status: string; quantity: number; basePrice: string }[];
  bookings: { id: string; code: string; status: string; checkIn: string; checkOut: string }[];
  restrictionAudits: { id: string; action: RestrictionAction; reason: string; evidenceReference: string | null; createdAt: string; actor: { fullName: string }; futureBookingCount: number }[];
  operationalTasks: { id: string; booking: { code: string; status: string; checkIn: string; checkOut: string } }[];
  allowedActions: { hide: boolean; suspend: boolean; restore: boolean };
  restoreBlockers: string[]; evidenceAvailable: boolean;
};
export type ManagedHotelQuery = { search?: string; ownerId?: string; type?: string; status?: string; visibility?: 'ALL' | 'VISIBLE' | 'HIDDEN'; page: number; limit: number };
export type ManagedHotelPage = { items: ManagedHotel[]; total: number; page: number; limit: number };

export const managedHotelApi = {
  async list(query: ManagedHotelQuery) {
    return (await apiClient.get<ManagedHotelPage>('/admin/hotels', { params: query })).data;
  },
  async detail(id: string) {
    return (await apiClient.get<ManagedHotelDetail>(`/admin/hotels/${encodeURIComponent(id)}`)).data;
  },
  async decide(id: string, body: { action: RestrictionAction; reason: string; evidenceReference?: string; expectedRestrictionVersion: number; expectedProfileVersion: number; requestId: string }) {
    return (await apiClient.post(`/admin/hotels/${encodeURIComponent(id)}/decision`, body)).data;
  },
};
