import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/services/api-client";
import { useTravelerStore } from "@/features/traveler/store";
import { canUseWishlist, defaultWishlist, type Wishlist } from "./model";

const key = (userId?: string) => ["wishlists", userId] as const;

export function useWishlists() {
  const session = useTravelerStore((state) => state.session);
  const userId =
    session?.mode === "api" && canUseWishlist(session.role)
      ? session.userId
      : undefined;
  return useQuery({
    queryKey: key(userId),
    queryFn: async () => (await apiClient.get<Wishlist[]>("/wishlists")).data,
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
}

export function useWishlistMutations() {
  const session = useTravelerStore((state) => state.session);
  const userId =
    session?.mode === "api" && canUseWishlist(session.role)
      ? session.userId
      : undefined;
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: key(userId) });

  const create = useMutation({
    mutationFn: async (name: string) =>
      (await apiClient.post<Wishlist>("/wishlists", { name })).data,
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: async ({
      wishlistId,
      name,
    }: {
      wishlistId: string;
      name: string;
    }) =>
      (
        await apiClient.patch<Wishlist>(
          `/wishlists/${encodeURIComponent(wishlistId)}`,
          { name },
        )
      ).data,
    onSuccess: refresh,
  });
  const removeList = useMutation({
    mutationFn: async (wishlistId: string) =>
      (await apiClient.delete(`/wishlists/${encodeURIComponent(wishlistId)}`))
        .data,
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: async ({
      wishlistId,
      hotelId,
    }: {
      wishlistId: string;
      hotelId: string;
    }) =>
      (
        await apiClient.put(
          `/wishlists/${encodeURIComponent(wishlistId)}/hotels/${encodeURIComponent(hotelId)}`,
        )
      ).data,
    onSuccess: refresh,
  });
  const unsave = useMutation({
    mutationFn: async ({
      wishlistId,
      hotelId,
    }: {
      wishlistId: string;
      hotelId: string;
    }) =>
      (
        await apiClient.delete(
          `/wishlists/${encodeURIComponent(wishlistId)}/hotels/${encodeURIComponent(hotelId)}`,
        )
      ).data,
    onSuccess: refresh,
  });

  return {
    authenticated: Boolean(userId),
    create,
    rename,
    removeList,
    save,
    unsave,
  };
}

export function useFavoriteHotel(hotelId: string) {
  const query = useWishlists();
  const actions = useWishlistMutations();
  const list = defaultWishlist(query.data);
  const saved = Boolean(list?.items.some((item) => item.hotelId === hotelId));
  const pending = actions.save.isPending || actions.unsave.isPending;
  const toggle = () => {
    if (!actions.authenticated || !list || pending) return;
    const input = { wishlistId: list.id, hotelId };
    if (saved) actions.unsave.mutate(input);
    else actions.save.mutate(input);
  };

  return {
    authenticated: actions.authenticated,
    error: actions.save.error ?? actions.unsave.error,
    loading: actions.authenticated && query.isPending,
    pending,
    saved,
    toggle,
  };
}
