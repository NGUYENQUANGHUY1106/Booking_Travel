import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";

export type BookingInvoice = {
  id: string;
  invoiceNumber: string;
  documentType: "BOOKING_SUMMARY" | "PAYMENT_RECEIPT";
  issuedAt: string;
  fileName: string;
  pdfFileName: string;
  documentHtml: string;
  snapshot: {
    booking: {
      id: string;
      code: string;
      status: string;
      createdAt: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      roomCount: number;
      adults: number;
      children: number;
      roomName: string;
      roomType: string;
      totalAmount: string;
      currency: string;
    };
    hotel: {
      name: string;
      address: string;
      email: string | null;
      phone: string | null;
    };
    guest: { name: string; email: string; phone: string | null };
    paymentStatus: string | null;
    payment: {
      id: string;
      reference: string | null;
      provider: string | null;
      method: string | null;
      amount: string;
      currency: string;
      paidAt: string;
    } | null;
  };
};

export async function downloadBookingInvoicePdf(bookingId: string) {
  return (
    await apiClient.get<ArrayBuffer>(`/bookings/${bookingId}/invoice/pdf`, {
      responseType: "arraybuffer",
    })
  ).data;
}

export function useBookingInvoice(bookingId?: string) {
  return useQuery({
    queryKey: ["booking-invoice", bookingId],
    queryFn: async () =>
      (await apiClient.get<BookingInvoice>(`/bookings/${bookingId}/invoice`))
        .data,
    enabled: Boolean(bookingId),
    retry: false,
  });
}
