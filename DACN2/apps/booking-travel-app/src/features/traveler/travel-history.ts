import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiClient } from "@/services/api-client";
import type { HotelStaySearchResponse } from "./public-hotels";
import { useTravelerStore } from "./store";

export type SearchCriteria = HotelStaySearchResponse["criteria"];
type SearchEntry = { id: string; criteria: SearchCriteria; searchedAt: string };
type HotelEntry = {
  hotelId: string;
  hotelName: string;
  viewedAt: string;
  viewCount: number;
};
export type TravelHistory = {
  enabled: boolean;
  searches: SearchEntry[];
  hotels: HotelEntry[];
};
export const travelHistoryPath = "/users/me/travel-history";
export const travelHistoryHeaders = (accountId: string) => ({
  "X-Travel-History-Account": accountId,
});
export const travelHistoryKey = (scope: string) => ["travel-history", scope];
const empty = { searches: [], hotels: [] };
const maxGuestEntries = 20;

interface GuestHistory extends TravelHistory {
  consent: (enabled: boolean) => void;
  search: (criteria: SearchCriteria) => void;
  hotel: (hotelId: string, hotelName: string) => void;
  remove: (kind: "searches" | "hotels", id: string) => void;
  clear: () => void;
}

export const useGuestHistory = create<GuestHistory>()(
  persist(
    (set) => ({
      ...empty,
      enabled: false,
      consent: (enabled) => set(enabled ? { enabled } : { enabled, ...empty }),
      search: (criteria) =>
        set((state) => {
          if (!state.enabled) return state;
          const id = JSON.stringify({
            ...criteria,
            destination: criteria.destination.toLocaleLowerCase("vi-VN"),
          });
          return {
            searches: [
              { id, criteria, searchedAt: new Date().toISOString() },
              ...state.searches.filter((entry) => entry.id !== id),
            ].slice(0, maxGuestEntries),
          };
        }),
      hotel: (hotelId, hotelName) =>
        set((state) => {
          if (!state.enabled) return state;
          const previous = state.hotels.find(
            (entry) => entry.hotelId === hotelId,
          );
          const entry = {
            hotelId,
            hotelName,
            viewedAt: new Date().toISOString(),
            viewCount: (previous?.viewCount ?? 0) + 1,
          };
          return {
            hotels: [
              entry,
              ...state.hotels.filter((item) => item.hotelId !== hotelId),
            ].slice(0, maxGuestEntries),
          };
        }),
      remove: (kind, id) =>
        set((state) =>
          kind === "searches"
            ? { searches: state.searches.filter((item) => item.id !== id) }
            : { hotels: state.hotels.filter((item) => item.hotelId !== id) },
        ),
      clear: () => set(empty),
    }),
    {
      name: "booking-travel-guest-history",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useHistoryHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const check = () =>
      setReady(
        useTravelerStore.persist.hasHydrated() &&
          useGuestHistory.persist.hasHydrated(),
      );
    const stopTraveler = useTravelerStore.persist.onFinishHydration(check);
    const stopHistory = useGuestHistory.persist.onFinishHydration(check);
    check();
    return () => {
      stopTraveler();
      stopHistory();
    };
  }, []);
  return ready;
}

export const historyAccountId = (
  session: ReturnType<typeof useTravelerStore.getState>["session"],
) => (session?.mode === "api" ? session.userId : undefined);

export function useTrackTravelHistory(
  search?: SearchCriteria,
  hotelId?: string,
  hotelName?: string,
) {
  const ready = useHistoryHydrated();
  const accountId = useTravelerStore((state) =>
    historyAccountId(state.session),
  );
  const client = useQueryClient();
  // Criteria are serialized to avoid recording the same result on each background refetch.
  const lastSearch = useRef<string | undefined>(undefined);
  const key = search ? JSON.stringify(search) : undefined;
  useFocusEffect(
    useCallback(() => {
      if (!ready || (!key && (!hotelId || !hotelName))) return;
      if (historyAccountId(useTravelerStore.getState().session) !== accountId)
        return;
      const searchScope = accountId ?? "device";
      if (key && lastSearch.current === searchScope + key) return;
      if (key) lastSearch.current = searchScope + key;
      const criteria = key ? (JSON.parse(key) as SearchCriteria) : undefined;
      if (!accountId) {
        const guest = useGuestHistory.getState();
        if (criteria) guest.search(criteria);
        else if (hotelId && hotelName) guest.hotel(hotelId, hotelName);
        return;
      }
      const controller = new AbortController();
      const path = travelHistoryPath + (criteria ? "/searches" : "/hotels");
      const body = criteria
        ? Object.fromEntries(
            Object.entries(criteria).filter(([, value]) => value !== null),
          )
        : { hotelId };
      void apiClient
        .post(path, body, {
          signal: controller.signal,
          headers: travelHistoryHeaders(accountId),
        })
        .then(() =>
          client.invalidateQueries({ queryKey: travelHistoryKey(accountId) }),
        )
        .catch(() => {
          if (key && lastSearch.current === searchScope + key)
            lastSearch.current = undefined;
        });
      return () => controller.abort();
    }, [ready, key, hotelId, hotelName, accountId, client]),
  );
}
