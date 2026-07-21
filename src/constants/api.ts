/**
 * API base URL for the Family AI Concierge backend.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_BASE_URL when set (physical device / explicit override)
 * 2. Same-origin relative URLs in production Web builds (Vercel co-host)
 * 3. http://localhost:3001 for local development
 *
 * Never put OpenAI keys in EXPO_PUBLIC_* variables.
 */
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

const localDevFallback = 'http://localhost:3001';
const isProduction = process.env.NODE_ENV === 'production';

function resolveApiBaseUrl(): string {
  if (configuredBaseUrl && configuredBaseUrl.length > 0) {
    return configuredBaseUrl.replace(/\/$/, '');
  }
  // Production Expo Web on Vercel: call /api/* on the same origin.
  if (isProduction) {
    return '';
  }
  return localDevFallback;
}

export const API_BASE_URL = resolveApiBaseUrl();

function joinApiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return normalized;
  }
  return `${API_BASE_URL}${normalized}`;
}

export const RECOMMENDATIONS_URL = joinApiPath('/api/recommendations');
export const SPOTS_URL = joinApiPath('/api/spots');
export const HEALTH_URL = joinApiPath('/health');

export function buildSpotsUrl(params?: {
  prefecture?: string;
  city?: string;
}): string {
  // Absolute base for URL parsing when API_BASE_URL is empty (relative same-origin).
  const absoluteBase = API_BASE_URL || 'http://local.invalid';
  const url = new URL('/api/spots', `${absoluteBase}/`);
  if (params?.prefecture && params.prefecture.trim() !== '') {
    url.searchParams.set('prefecture', params.prefecture.trim());
  }
  if (params?.city && params.city.trim() !== '') {
    url.searchParams.set('city', params.city.trim());
  }
  if (!API_BASE_URL) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}
