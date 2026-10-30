import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/services/api-client";

export type AccommodationPreferenceType =
  "HOTEL" | "RESORT" | "VILLA" | "APARTMENT" | "HOMESTAY" | "HOSTEL";
export type TravelTripType =
  "SOLO" | "COUPLE" | "FAMILY" | "FRIENDS" | "BUSINESS" | "WELLNESS";
export type TravelAmenityPreference =
  | "WIFI"
  | "BREAKFAST"
  | "POOL"
  | "PARKING"
  | "SPA"
  | "GYM"
  | "BEACH"
  | "AIRPORT_SHUTTLE"
  | "PET_FRIENDLY"
  | "FAMILY_ROOM";
export type TravelAreaPreference =
  | "BEACHFRONT"
  | "CITY_CENTER"
  | "QUIET"
  | "NEAR_AIRPORT"
  | "NEAR_ATTRACTIONS"
  | "NIGHTLIFE"
  | "LOCAL_CULTURE"
  | "NATURE";

export interface TravelPreferences {
  budgetMin: number | null;
  budgetMax: number | null;
  currency: "VND";
  accommodationTypes: AccommodationPreferenceType[];
  tripTypes: TravelTripType[];
  preferredAmenities: TravelAmenityPreference[];
  preferredAreas: TravelAreaPreference[];
  updatedAt: string | null;
}

export type UpdateTravelPreferencesInput = Omit<TravelPreferences, "updatedAt">;

export const TRAVEL_PREFERENCES_QUERY_KEY = [
  "user-travel-preferences",
  "me",
] as const;

export const travelPreferencesApi = {
  async getMine() {
    const response = await apiClient.get<TravelPreferences>(
      "/users/me/travel-preferences",
    );
    return response.data;
  },

  async updateMine(input: UpdateTravelPreferencesInput) {
    const response = await apiClient.put<TravelPreferences>(
      "/users/me/travel-preferences",
      input,
    );
    return response.data;
  },

  async resetMine() {
    const response = await apiClient.delete<TravelPreferences>(
      "/users/me/travel-preferences",
    );
    return response.data;
  },
};

export function useTravelPreferences(enabled: boolean) {
  return useQuery({
    queryKey: TRAVEL_PREFERENCES_QUERY_KEY,
    queryFn: travelPreferencesApi.getMine,
    enabled,
  });
}

export function useUpdateTravelPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: travelPreferencesApi.updateMine,
    onSuccess: (data) =>
      queryClient.setQueryData(TRAVEL_PREFERENCES_QUERY_KEY, data),
  });
}

export function useResetTravelPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: travelPreferencesApi.resetMine,
    onSuccess: (data) =>
      queryClient.setQueryData(TRAVEL_PREFERENCES_QUERY_KEY, data),
  });
}
