import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ownerHotelApi, ownerHotelKey, ownerHotelListKey, type AccommodationType, type OwnerHotelProfile } from './api';
import { ownerHotelDraftKey } from './draft-storage';
import { apiClient } from '@/services/api-client';
import { useTravelerStore } from '@/features/traveler/store';

type BasicFields = { name: string; accommodationType: AccommodationType | null; description: string };
type LocalDraft = BasicFields & { clientDraftId: string; hotelId?: string; profileVersion?: number };
type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict' | 'forbidden';

const blank: BasicFields = { name: '', accommodationType: null, description: '' };

function draftId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function sameBasic(fields: BasicFields, profile: OwnerHotelProfile) {
  return fields.name.trim() === profile.name && fields.accommodationType === profile.accommodationType &&
    fields.description.trim() === (profile.description ?? '');
}

function isCurrentOwnerSession(userId?: string, sessionId?: string) {
  const session = useTravelerStore.getState().session;
  return session?.mode === 'api' && session.role === 'HOTEL_OWNER' && session.userId === userId && session.sessionId === sessionId;
}

export function useHotelBasicDraft(userId?: string, sessionId?: string, editHotelId?: string) {
  const queryClient = useQueryClient();
  const cacheKey = userId && sessionId && !editHotelId ? ownerHotelDraftKey(userId, sessionId) : undefined;
  const [fields, setFields] = useState<BasicFields>(blank);
  const [status, setStatus] = useState<SaveStatus>('unsaved');
  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState<string>();
  const [hotelStatus, setHotelStatus] = useState<OwnerHotelProfile['status']>();
  const latest = useRef<BasicFields>(blank);
  const server = useRef<OwnerHotelProfile | null>(null);
  const pendingHotelId = useRef<string | undefined>(editHotelId);
  const localDraftId = useRef(draftId());
  const inFlight = useRef<Promise<OwnerHotelProfile | null> | null>(null);
  const saveStatus = useRef<SaveStatus>('unsaved');
  const initialized = useRef(false);

  const markStatus = useCallback((next: SaveStatus, message?: string) => {
    saveStatus.current = next;
    setStatus(next);
    setErrorText(message);
  }, []);

  const applyFields = useCallback((value: BasicFields) => {
    latest.current = value;
    setFields(value);
  }, []);

  useEffect(() => {
    if (!userId || !sessionId || initialized.current) return;
    initialized.current = true;
    let cancelled = false;
    const load = async () => {
      try {
        if (editHotelId) {
          const profile = (await apiClient.get<OwnerHotelProfile>(`/owner/hotels/${editHotelId}`)).data;
          if (cancelled) return;
          server.current = profile;
          pendingHotelId.current = profile.id;
          setHotelStatus(profile.status);
          applyFields({ name: profile.name, accommodationType: profile.accommodationType, description: profile.description ?? '' });
          markStatus('saved');
        } else if (cacheKey) {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (cancelled) return;
          if (raw) {
            const saved = JSON.parse(raw) as LocalDraft;
            if (typeof saved.clientDraftId === 'string' && typeof saved.name === 'string' && typeof saved.description === 'string') {
              localDraftId.current = saved.clientDraftId;
              pendingHotelId.current = saved.hotelId;
              applyFields({ name: saved.name, accommodationType: saved.accommodationType ?? null, description: saved.description });
              if (saved.hotelId) {
                const profile = (await apiClient.get<OwnerHotelProfile>(`/owner/hotels/${saved.hotelId}`)).data;
                if (cancelled) return;
                server.current = profile;
                setHotelStatus(profile.status);
                if (saved.profileVersion !== profile.profileVersion && !sameBasic(saved, profile)) {
                  markStatus('conflict', 'Hồ sơ đã thay đổi ở nơi khác. Tải lại trước khi sửa tiếp.');
                } else if (sameBasic(saved, profile)) {
                  markStatus('saved');
                  await AsyncStorage.removeItem(cacheKey);
                }
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          const forbidden = isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0);
          if (forbidden) {
            applyFields(blank);
            server.current = null;
            if (cacheKey) void AsyncStorage.removeItem(cacheKey);
          }
          markStatus(forbidden ? 'forbidden' : 'error', forbidden ? 'Không còn quyền truy cập hồ sơ này.' : 'Không tải được hồ sơ. Kiểm tra mạng rồi thử lại.');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void load();
    return () => { cancelled = true; initialized.current = false; };
  }, [userId, sessionId, editHotelId, cacheKey, applyFields, markStatus]);

  const updateField = useCallback(<K extends keyof BasicFields>(key: K, value: BasicFields[K]) => {
    if (saveStatus.current === 'forbidden' || !isCurrentOwnerSession(userId, sessionId)) return;
    const next = { ...latest.current, [key]: value };
    applyFields(next);
    markStatus('unsaved');
    if (cacheKey) {
      const cached: LocalDraft = { ...next, clientDraftId: localDraftId.current, hotelId: pendingHotelId.current, profileVersion: server.current?.profileVersion };
      void AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
    }
  }, [applyFields, cacheKey, markStatus, userId, sessionId]);

  const flush = useCallback(async (): Promise<OwnerHotelProfile | null> => {
    if (!ready || !userId || !sessionId || !isCurrentOwnerSession(userId, sessionId) || saveStatus.current === 'conflict' || saveStatus.current === 'forbidden') return null;
    while (true) {
    if (!isCurrentOwnerSession(userId, sessionId)) {
      if (cacheKey) void AsyncStorage.removeItem(cacheKey);
      return null;
    }
    if (inFlight.current) {
      const previous = await inFlight.current;
      if (!previous) return null;
      continue;
    }
    const snapshot = latest.current;
    if (snapshot.name.trim().length < 2 || !snapshot.accommodationType) {
      markStatus('unsaved');
      return null;
    }
    if (server.current && sameBasic(snapshot, server.current)) {
      if (cacheKey) await AsyncStorage.removeItem(cacheKey);
      markStatus('saved');
      return server.current;
    }
    const accommodationType = snapshot.accommodationType;
    const work = (async () => {
      markStatus('saving');
      try {
        if (cacheKey && !server.current) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ ...snapshot, clientDraftId: localDraftId.current, hotelId: pendingHotelId.current } satisfies LocalDraft));
        }
        if (!isCurrentOwnerSession(userId, sessionId)) {
          if (cacheKey) await AsyncStorage.removeItem(cacheKey);
          return null;
        }
        // An uncertain POST result must be reconciled by the persisted idempotency key.
        const result = server.current
          ? await ownerHotelApi.updateProfile(server.current.id, server.current.profileVersion, {
              name: snapshot.name.trim(), accommodationType,
              description: snapshot.description.trim() || null,
            })
          : pendingHotelId.current
            ? (await apiClient.get<OwnerHotelProfile>(`/owner/hotels/${pendingHotelId.current}`)).data
            : await ownerHotelApi.createDraft({ clientDraftId: localDraftId.current, name: snapshot.name.trim(), accommodationType, description: snapshot.description.trim() });
        if (!isCurrentOwnerSession(userId, sessionId)) {
          if (cacheKey) await AsyncStorage.removeItem(cacheKey);
          return null;
        }
        server.current = result;
        pendingHotelId.current = result.id;
        setHotelStatus(result.status);
        queryClient.setQueryData(ownerHotelKey(userId, result.id), result);
        void queryClient.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
        if (cacheKey) {
          if (sameBasic(latest.current, result)) await AsyncStorage.removeItem(cacheKey);
          else await AsyncStorage.setItem(cacheKey, JSON.stringify({ ...latest.current, clientDraftId: localDraftId.current, hotelId: result.id, profileVersion: result.profileVersion } satisfies LocalDraft));
        }
        markStatus(sameBasic(latest.current, result) ? 'saved' : 'unsaved');
        return result;
      } catch (error) {
        if (isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0)) {
          if (cacheKey) void AsyncStorage.removeItem(cacheKey);
          applyFields(blank);
          server.current = null;
          markStatus('forbidden', 'Không còn quyền truy cập hồ sơ này.');
        } else if (isAxiosError(error) && error.response?.status === 409) {
          markStatus('conflict', 'Hồ sơ đã thay đổi ở nơi khác. Tải lại trước khi sửa tiếp.');
        } else {
          markStatus('error', 'Chưa lưu được. Kiểm tra mạng rồi thử lại.');
        }
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = work;
    const result = await work;
    if (!result || sameBasic(latest.current, result)) return result;
    }
  }, [ready, userId, sessionId, cacheKey, markStatus, queryClient, applyFields]);

  useEffect(() => {
    if (!ready || status !== 'unsaved' || !fields.name.trim() || !fields.accommodationType) return;
    const timer = setTimeout(() => { void flush(); }, 700);
    return () => clearTimeout(timer);
  }, [fields, ready, status, flush]);

  const reload = useCallback(async () => {
    const id = pendingHotelId.current;
    if (!id) return;
    try {
      const profile = (await apiClient.get<OwnerHotelProfile>(`/owner/hotels/${id}`)).data;
      server.current = profile;
      setHotelStatus(profile.status);
      applyFields({ name: profile.name, accommodationType: profile.accommodationType, description: profile.description ?? '' });
      if (cacheKey) await AsyncStorage.removeItem(cacheKey);
      markStatus('saved');
    } catch { markStatus('error', 'Không tải được hồ sơ. Kiểm tra mạng rồi thử lại.'); }
  }, [applyFields, cacheKey, markStatus]);

  return { fields, updateField, flush, reload, ready, status, errorText, hotelStatus };
}
