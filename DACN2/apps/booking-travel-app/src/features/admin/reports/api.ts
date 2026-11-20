import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { useTravelerStore } from "@/features/traveler/store";

export type AdminHotelReport = {
  id: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  hotel: {
    id: string;
    name: string;
    addressLine: string | null;
    province: string | null;
  };
  booking: {
    id: string;
    code: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomNameSnapshot: string;
  };
  reporter: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
};

const key = ["admin", "hotel-reports"] as const;

function useAdminIdentity() {
  const session = useTravelerStore((state) => state.session);
  return {
    enabled: session?.mode === "api" && session.role === "ADMIN",
    identity: [
      session?.mode === "api" ? session.userId : "",
      session?.mode === "api" ? session.sessionId : "",
    ],
  };
}

export function useAdminHotelReports() {
  const { enabled, identity } = useAdminIdentity();
  return useQuery({
    queryKey: [...key, ...identity, "list"],
    queryFn: async () =>
      (await apiClient.get<AdminHotelReport[]>("/admin/hotel-reports")).data,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useAdminHotelReport(id: string, allow = true) {
  const { enabled, identity } = useAdminIdentity();
  return useQuery({
    queryKey: [...key, ...identity, "detail", id],
    queryFn: async () =>
      (
        await apiClient.get<AdminHotelReport>(
          `/admin/hotel-reports/${encodeURIComponent(id)}`,
        )
      ).data,
    enabled: enabled && allow && Boolean(id),
    retry: false,
  });
}
