import { create, isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

export function resolveApiBaseUrl(configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL) {
  if (Platform.OS === 'web') return configuredUrl;

  const expoHost = Constants.expoConfig?.hostUri?.replace(/^https?:\/\//, '').split(':')[0];

  if (!expoHost || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredUrl)) {
    return configuredUrl;
  }

  return configuredUrl.replace(/(localhost|127\.0\.0\.1)/i, expoHost);
}

export const apiClient = create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15_000,
});

let refreshAccessToken: (() => Promise<string | undefined>) | undefined;
let refreshInFlight: Promise<string | undefined> | undefined;

export function setApiRefreshHandler(handler: () => Promise<string | undefined>) {
  refreshAccessToken = handler;
}

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== 401 || !error.config || error.config.url?.startsWith('/auth/')) {
    return Promise.reject(error);
  }
  const request = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  if (request._retry || !refreshAccessToken) return Promise.reject(error);
  request._retry = true;
  refreshInFlight ??= refreshAccessToken().finally(() => { refreshInFlight = undefined; });
  try {
    const token = await refreshInFlight;
    if (!token) return Promise.reject(error);
    request.headers.Authorization = `Bearer ${token}`;
    return apiClient(request);
  } catch {
    return Promise.reject(error);
  }
});

export function setApiAccessToken(accessToken?: string) {
  if (accessToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    return;
  }

  delete apiClient.defaults.headers.common.Authorization;
}
