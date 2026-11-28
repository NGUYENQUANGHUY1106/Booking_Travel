import { isAxiosError } from "axios";
import { apiClient } from "@/services/api-client";

export type HotelReportReason =
  | "INCORRECT_INFORMATION"
  | "INCORRECT_LOCATION"
  | "MISLEADING_IMAGES"
  | "FRAUD"
  | "INAPPROPRIATE_CONTENT"
  | "SAFETY"
  | "OTHER";

export type CreatedHotelReport = {
  id: string;
  bookingId: string;
  hotelId: string;
  reason: HotelReportReason;
  status: "OPEN";
  createdAt: string;
};

export async function createHotelReport(input: {
  bookingId?: string;
  hotelId: string;
  reason: HotelReportReason;
  description: string;
}) {
  return (await apiClient.post<CreatedHotelReport>("/hotel-reports", input))
    .data;
}

export function hotelReportError(error: unknown) {
  if (isAxiosError(error)) {
    const body = error.response?.data as
      { message?: string | string[] } | undefined;
    if (Array.isArray(body?.message)) return body.message.join(". ");
    if (typeof body?.message === "string") return body.message;
    if (!error.response)
      return "Không kết nối được máy chủ. Hãy kiểm tra mạng và thử lại.";
  }
  return "Không thể gửi báo cáo. Vui lòng thử lại.";
}
