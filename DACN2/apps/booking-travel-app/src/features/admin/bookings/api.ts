import { apiClient } from "@/services/api-client";

export type AdminBookingItem = {
  id: string;
  code: string;
  hotelId: string;
  userId: string;
  hotelName: string;
  roomName: string;
  roomType: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomCount: number;
  totalAmount: string;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string | null;
  refundStatus: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AdminBookingPage = {
  items: AdminBookingItem[];
  total: number;
  page: number;
  limit: number;
};
export type AdminBookingDetail = {
  booking: {
    id: string;
    code: string;
    quoteId: string | null;
    userId: string;
    hotelId: string;
    roomId: string;
    hotelNameSnapshot: string;
    hotelAddressSnapshot: string;
    roomNameSnapshot: string;
    roomTypeSnapshot: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    roomCount: number;
    nights: number;
    pricePerNight: string;
    totalAmount: string;
    currency: string;
    nightlyRatesSnapshot: unknown;
    cancellationPolicySnapshot: string | null;
    refundRulesSnapshot: unknown;
    checkInTimeSnapshot: string | null;
    status: string;
    paymentMethod: string;
    paymentDeadline: string | null;
    guestName: string;
    guestEmail: string;
    guestPhone: string | null;
    cancellationReason: string | null;
    cancellationFee: string | null;
    refundEstimate: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    hotel: {
      name: string;
      status: string;
      ownerId: string;
      owner: { fullName: string };
    };
    user: { fullName: string };
  };
  payments: {
    id: string;
    status: string;
    provider: string | null;
    reference: string | null;
    merchantReference: string | null;
    providerTxnId: string | null;
    amount: string;
    currency: string;
    createdAt: string;
    reconciliationRequired: boolean;
  }[];
  refunds: {
    id: string;
    paymentId: string;
    status: string;
    amount: string | null;
    currency: string;
    providerRefundRef: string | null;
    reason: string;
    createdAt: string;
  }[];
  paymentCount: number;
  refundCount: number;
  capturedOnlineAmount: string;
  refundedAmount: string;
  needsReconciliation: boolean;
  timeline: {
    id: string;
    at: string;
    label: string;
    source: string;
    kind: "actual" | "scheduled";
    actorId?: string | null;
    referenceId?: string | null;
  }[];
  dataGaps: string[];
};

export async function listAdminBookings(
  params: Record<string, string | number | undefined>,
) {
  return (await apiClient.get<AdminBookingPage>("/admin/bookings", { params }))
    .data;
}

export async function getAdminBooking(id: string) {
  return (
    await apiClient.get<AdminBookingDetail>(
      `/admin/bookings/${encodeURIComponent(id)}`,
    )
  ).data;
}
