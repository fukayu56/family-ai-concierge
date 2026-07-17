/**
 * API base URL for the Family AI Concierge backend.
 *
 * Override for physical devices (same Wi-Fi as the PC running the server):
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3001
 *
 * See README.md "実機からAPIへ接続する" for setup steps.
 * Falls back to localhost for Expo Web / same-machine development.
 */
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL =
  configuredBaseUrl && configuredBaseUrl.length > 0
    ? configuredBaseUrl.replace(/\/$/, '')
    : 'http://localhost:3001';

export const RECOMMENDATIONS_URL = `${API_BASE_URL}/api/recommendations`;
export const HEALTH_URL = `${API_BASE_URL}/health`;
