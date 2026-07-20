/**
 * API base URL for the Family AI Concierge backend.
 *
 * Override for physical devices (same Wi-Fi as the PC running the server):
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3001
 *
 * See README.md "実機からAPIへ接続する" for setup steps.
 * Falls back to localhost only for development.
 * In production, we avoid accidentally calling localhost by using an invalid fallback.
 */
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

const localDevFallback = 'http://localhost:3001';
// Used only when EXPO_PUBLIC_API_BASE_URL is missing during production builds.
const productionFallback = 'https://example.invalid';
const isProduction = process.env.NODE_ENV === 'production';

export const API_BASE_URL =
  configuredBaseUrl && configuredBaseUrl.length > 0
    ? configuredBaseUrl.replace(/\/$/, '')
    : isProduction
      ? productionFallback
      : localDevFallback;

export const RECOMMENDATIONS_URL = `${API_BASE_URL}/api/recommendations`;
export const SPOTS_URL = `${API_BASE_URL}/api/spots`;
export const HEALTH_URL = `${API_BASE_URL}/health`;

export function buildSpotsUrl(params?: {
  prefecture?: string;
  city?: string;
}): string {
  const url = new URL(SPOTS_URL);
  if (params?.prefecture && params.prefecture.trim() !== '') {
    url.searchParams.set('prefecture', params.prefecture.trim());
  }
  if (params?.city && params.city.trim() !== '') {
    url.searchParams.set('city', params.city.trim());
  }
  return url.toString();
}
