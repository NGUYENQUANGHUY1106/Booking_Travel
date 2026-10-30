import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { UserRole } from '@/features/auth';
import { setApiAccessToken } from '@/services/api-client';

import { type AccommodationType, type Amenity, HOTELS } from './data';
import { setDisplayCurrency } from './money';
import { calculateBookingQuote, roomRate } from './pricing';
import type { ProfileGender } from './profile-api';

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
export type MockSessionRole = 'USER' | 'HOTEL_OWNER' | 'ADMIN';

export interface ApiSessionInput {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface MockBooking {
  id: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  room: string;
  amount: number;
  status: BookingStatus;
}

export interface MockReview {
  bookingId: string;
  rating: number;
  text: string;
  criteria: Record<string, number>;
  imageUri?: string;
}

export interface SearchFilters {
  types: AccommodationType[];
  amenities: Amenity[];
  minPrice: number;
  maxPrice: number;
  stars: number[];
  minRating: number;
  freeCancellation: boolean;
}

export type SortKey = 'recommended' | 'priceAsc' | 'priceDesc' | 'rating' | 'nearest' | 'popular' | 'deals';

interface TravelerState {
  session: { mode: 'mock'; email: string; role: MockSessionRole } | { mode: 'api'; userId: string; email: string; role: UserRole; accessToken: string; refreshToken: string; sessionId: string } | null;
  profile: { name: string; email: string; phone: string; avatarUrl: string; dateOfBirth: string; gender: ProfileGender | null; nationality: string; address: string; createdAt: string; emailVerified: boolean; phoneVerified: boolean; language: string; currency: string; preferences: string[] };
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  filters: SearchFilters;
  sort: SortKey;
  favorites: string[];
  compare: string[];
  selectedHotelId: string;
  selectedRoom: string;
  guestName: string;
  guestPhone: string;
  specialRequest: string;
  voucher: string;
  paymentMethod: 'card' | 'bank' | 'wallet';
  selectedBookingId: string | null;
  bookings: MockBooking[];
  messages: { id: string; text: string; mine: boolean }[];
  notificationSettings: { booking: boolean; deal: boolean; chat: boolean };
  aiMessages: { id: string; text: string; mine: boolean }[];
  tripBudget: number;
  travelPlanCreated: boolean;
  packingItems: { id: string; label: string; checked: boolean }[];
  reviews: MockReview[];
  login: (email: string, role?: MockSessionRole) => void;
  loginWithApiSession: (session: ApiSessionInput) => void;
  logout: () => void;
  updateProfile: (patch: Partial<TravelerState['profile']>) => void;
  setSearch: (patch: Partial<Pick<TravelerState, 'destination' | 'checkIn' | 'checkOut' | 'adults' | 'children' | 'rooms'>>) => void;
  setFilters: (patch: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  setSort: (sort: SortKey) => void;
  toggleFavorite: (hotelId: string) => void;
  toggleCompare: (hotelId: string) => void;
  selectHotel: (hotelId: string) => void;
  selectRoom: (room: string) => void;
  setBookingDraft: (patch: Partial<Pick<TravelerState, 'guestName' | 'guestPhone' | 'specialRequest' | 'voucher' | 'paymentMethod' | 'selectedBookingId'>>) => void;
  createBooking: () => string;
  updateBooking: (id: string, status: BookingStatus) => void;
  addMessage: (text: string) => void;
  setNotificationSettings: (patch: Partial<TravelerState['notificationSettings']>) => void;
  addAiMessage: (text: string, mine: boolean) => void;
  setTripBudget: (value: number) => void;
  setTravelPlanCreated: (value: boolean) => void;
  addPackingItem: (label: string) => void;
  togglePackingItem: (id: string) => void;
  removePackingItem: (id: string) => void;
  addReview: (review: MockReview) => void;
  removeReview: (bookingId: string) => void;
}

const INITIAL_FILTERS: SearchFilters = { types: ['HOTEL'], amenities: ['Hồ bơi'], minPrice: 500000, maxPrice: 2000000, stars: [4, 5], minRating: 8, freeCancellation: true };
const CLEAR_FILTERS: SearchFilters = { types: [], amenities: [], minPrice: 0, maxPrice: 5000000, stars: [], minRating: 0, freeCancellation: false };
const SESSION_STORAGE_KEY = 'booking-travel-user-mock-session';
const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: ['REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: [],
};

const storage: StateStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    let data = await AsyncStorage.getItem(key);
    if (!data) {
      const legacy = await SecureStore.getItemAsync(key);
      if (legacy) {
        await storage.setItem(key, legacy);
        await SecureStore.deleteItemAsync(key);
        data = await AsyncStorage.getItem(key);
      }
    }
    const session = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!data && !session) return null;
    const envelope = data ? JSON.parse(data) : { state: {}, version: 0 };
    envelope.state.session = session ? JSON.parse(session) : null;
    return JSON.stringify(envelope);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    const envelope = JSON.parse(value);
    const session = envelope.state.session;
    delete envelope.state.session;
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
    if (session) await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await Promise.all([AsyncStorage.removeItem(key), SecureStore.deleteItemAsync(SESSION_STORAGE_KEY)]);
  },
};

export const useTravelerStore = create<TravelerState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: { name: 'Nguyễn Minh Quang', email: 'quang051005@gmail.com', phone: '', avatarUrl: '', dateOfBirth: '', gender: null, nationality: '', address: '', createdAt: '', emailVerified: false, phoneVerified: false, language: 'Tiếng Việt', currency: 'VND', preferences: ['Biển', 'Ẩm thực'] },
      destination: 'Đà Nẵng',
      checkIn: '2026-10-12',
      checkOut: '2026-10-15',
      adults: 2,
      children: 0,
      rooms: 1,
      filters: INITIAL_FILTERS,
      sort: 'priceAsc',
      favorites: ['blue-horizon'],
      compare: ['blue-horizon', 'an-thu'],
      selectedHotelId: 'blue-horizon',
      selectedRoom: 'Deluxe Sea View',
      guestName: 'Nguyễn Minh Quang',
      guestPhone: '',
      specialRequest: '',
      voucher: 'TRAVEL12',
      paymentMethod: 'card',
      selectedBookingId: 'BT-DEMO-002',
      bookings: [
        { id: 'BT-DEMO-002', hotelId: 'blue-horizon', checkIn: '2026-10-12', checkOut: '2026-10-15', guests: 2, room: 'Deluxe Sea View', amount: 4350000, status: 'CONFIRMED' },
        { id: 'BT-DEMO-003', hotelId: 'seabreeze', checkIn: '2026-10-12', checkOut: '2026-10-15', guests: 2, room: 'Deluxe Sea View', amount: 3570000, status: 'CONFIRMED' },
        { id: 'BT-DEMO-001', hotelId: 'blue-horizon', checkIn: '2026-09-12', checkOut: '2026-09-15', guests: 2, room: 'Deluxe Sea View', amount: 4188000, status: 'COMPLETED' },
      ],
      messages: [],
      notificationSettings: { booking: true, deal: true, chat: true },
      aiMessages: [],
      tripBudget: 6000000,
      travelPlanCreated: false,
      packingItems: ['Giấy tờ tùy thân', 'Xác nhận đặt phòng & QR', 'Kem chống nắng', 'Sạc điện thoại', 'Trang phục đi biển'].map((label, index) => ({ id: `default-${index}`, label, checked: false })),
      reviews: [],
      login: (email, role = 'USER') => set((state) => ({ session: { mode: 'mock', email, role }, profile: { ...state.profile, email } })),
      loginWithApiSession: (session) => {
        setApiAccessToken(session.accessToken);
        set((state) => ({
          session: { mode: 'api', userId: session.userId, email: session.email, role: session.role, accessToken: session.accessToken, refreshToken: session.refreshToken, sessionId: session.sessionId },
          profile: { ...state.profile, name: session.fullName, email: session.email },
        }));
      },
      logout: () => {
        setApiAccessToken();
        set({ session: null });
      },
      updateProfile: (patch) =>
        set((state) => {
          if (patch.currency) setDisplayCurrency(patch.currency);
          return { profile: { ...state.profile, ...patch } };
        }),
      setSearch: (patch) => set(patch),
      setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
      resetFilters: () => set({ filters: CLEAR_FILTERS }),
      setSort: (sort) => set({ sort }),
      toggleFavorite: (hotelId) => set((state) => ({ favorites: state.favorites.includes(hotelId) ? state.favorites.filter((id) => id !== hotelId) : [...state.favorites, hotelId] })),
      toggleCompare: (hotelId) => set((state) => ({ compare: state.compare.includes(hotelId) ? state.compare.filter((id) => id !== hotelId) : state.compare.length < 4 ? [...state.compare, hotelId] : state.compare })),
      selectHotel: (hotelId) => set({ selectedHotelId: hotelId, selectedRoom: 'Deluxe Sea View' }),
      selectRoom: (room) => set({ selectedRoom: room }),
      setBookingDraft: (patch) => set(patch),
      createBooking: () => {
        const state = get();
        const hotel = HOTELS.find((item) => item.id === state.selectedHotelId) ?? HOTELS[0];
        const quote = calculateBookingQuote(roomRate(hotel.price, state.selectedRoom), state.checkIn, state.checkOut, state.rooms, state.voucher);
        if (quote.nights < 1) return '';
        const existing = state.bookings.find((booking) => booking.id === state.selectedBookingId && booking.status === 'CONFIRMED' && booking.hotelId === hotel.id && booking.checkIn === state.checkIn && booking.checkOut === state.checkOut && booking.room === state.selectedRoom && booking.amount === quote.total);
        if (existing) return existing.id;
        const id = `BT-${Date.now().toString(36).toUpperCase()}`;
        const booking: MockBooking = { id, hotelId: hotel.id, checkIn: state.checkIn, checkOut: state.checkOut, guests: state.adults + state.children, room: state.selectedRoom, amount: quote.total, status: 'CONFIRMED' };
        set({ bookings: [booking, ...state.bookings], selectedBookingId: id });
        return id;
      },
      updateBooking: (id, status) => set((state) => ({ bookings: state.bookings.map((booking) => (booking.id === id && ALLOWED_BOOKING_TRANSITIONS[booking.status].includes(status) ? { ...booking, status } : booking)) })),
      addMessage: (text) => set((state) => ({ messages: [...state.messages, { id: Date.now().toString(), text, mine: true }] })),
      setNotificationSettings: (patch) => set((state) => ({ notificationSettings: { ...state.notificationSettings, ...patch } })),
      addAiMessage: (text, mine) => set((state) => ({ aiMessages: [...state.aiMessages, { id: `${Date.now()}-${state.aiMessages.length}`, text, mine }] })),
      setTripBudget: (value) => set({ tripBudget: value }),
      setTravelPlanCreated: (value) => set({ travelPlanCreated: value }),
      addPackingItem: (label) => set((state) => ({ packingItems: [...state.packingItems, { id: `packing-${Date.now()}`, label, checked: false }] })),
      togglePackingItem: (id) => set((state) => ({ packingItems: state.packingItems.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)) })),
      removePackingItem: (id) => set((state) => ({ packingItems: state.packingItems.filter((item) => item.id !== id) })),
      addReview: (review) => set((state) => ({ reviews: [...state.reviews.filter((item) => item.bookingId !== review.bookingId), review] })),
      removeReview: (bookingId) => set((state) => ({ reviews: state.reviews.filter((review) => review.bookingId !== bookingId) })),
    }),
    {
      name: 'booking-travel-user-mock-v1',
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => (state) => {
        setDisplayCurrency(state?.profile.currency ?? 'VND');
        setApiAccessToken(state?.session?.mode === 'api' ? state.session.accessToken : undefined);
      },
      partialize: (state) => ({ session: state.session, profile: state.profile, destination: state.destination, checkIn: state.checkIn, checkOut: state.checkOut, adults: state.adults, children: state.children, rooms: state.rooms, filters: state.filters, sort: state.sort, favorites: state.favorites, compare: state.compare, selectedHotelId: state.selectedHotelId, selectedRoom: state.selectedRoom, guestName: state.guestName, guestPhone: state.guestPhone, specialRequest: state.specialRequest, voucher: state.voucher, paymentMethod: state.paymentMethod, selectedBookingId: state.selectedBookingId, bookings: state.bookings, messages: state.messages, notificationSettings: state.notificationSettings, aiMessages: state.aiMessages, tripBudget: state.tripBudget, travelPlanCreated: state.travelPlanCreated, packingItems: state.packingItems, reviews: state.reviews }),
    },
  ),
);
