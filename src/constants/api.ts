/**
 * API base URL for the local backend.
 *
 * Web (Expo web on the same PC): http://localhost:3001 works.
 *
 * Physical devices / emulators: localhost points to the device itself,
 * not your PC. Use your machine's LAN IP instead, e.g. http://192.168.x.x:3001
 * (and keep the phone on the same Wi-Fi network).
 */
export const API_BASE_URL = 'http://localhost:3001';

export const RECOMMENDATIONS_URL = `${API_BASE_URL}/api/recommendations`;
