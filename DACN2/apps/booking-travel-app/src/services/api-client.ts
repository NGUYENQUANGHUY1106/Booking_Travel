import { create } from 'axios';
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

export function setApiAccessToken(accessToken?: string) {
  if (accessToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    return;
  }

  delete apiClient.defaults.headers.common.Authorization;
}
