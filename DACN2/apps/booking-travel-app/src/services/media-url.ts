import { apiClient } from './api-client';

export function absoluteMediaUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    const mediaUrl = new URL(path);
    if (
      /^\/api\/(?:owner-covers|user-avatars|hotel-media)\//i.test(
        mediaUrl.pathname,
      )
    ) {
      const apiUrl = new URL(apiClient.defaults.baseURL!);
      mediaUrl.protocol = apiUrl.protocol;
      mediaUrl.host = apiUrl.host;
      return mediaUrl.toString();
    }

    return path;
  }

  return new URL(path, apiClient.defaults.baseURL).toString();
}
