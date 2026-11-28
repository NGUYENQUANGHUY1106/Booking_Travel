import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import type { PublicHotel } from "./public-hotels";
import { confirmedSearchStay } from "./stay-context";
import { useTravelerStore } from "./store";

export const HOTEL_RECOMMENDATIONS_KEY = ["hotel-recommendations"] as const;

type Recommendations = {
  mode: "PERSONALIZED" | "DISCOVERY";
  items: { hotel: PublicHotel; reasons: string[] }[];
};

export function useHotelRecommendations(enabled: boolean) {
  const user = useTravelerStore((state) => state.session);
  const destination = useTravelerStore((state) => state.destination);
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const selection = useTravelerStore((state) => state.staySelection);
  const rooms = useTravelerStore((state) => state.rooms);
  const adults = useTravelerStore((state) => state.adults);
  const children = useTravelerStore((state) => state.children);
  const account = user?.mode === "api" ? user.userId : undefined;
  const params = confirmedSearchStay(selection, checkIn, checkOut)
    ? {
        search: destination.trim() || undefined,
        checkIn,
        checkOut,
        rooms,
        adults,
        children,
      }
    : undefined;

  return useQuery({
    queryKey: [...HOTEL_RECOMMENDATIONS_KEY, account ?? "guest", params],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Recommendations>("/ai/hotel-recommendations", {
          params,
          signal,
          headers: account
            ? { "X-Recommendation-Account": account }
            : { Authorization: false },
        })
      ).data,
    enabled,
    retry: false,
    gcTime: 0,
    staleTime: 30_000,
  });
}
