export function formatDistance(distanceMeters?: number | null) {
  if (distanceMeters === null || distanceMeters === undefined) return null;
  if (distanceMeters < 1000) return `${Math.max(1, Math.round(distanceMeters))} m`;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(distanceMeters / 1000)} km`;
}
