/** Aichi-only for current production dataset (6 cities). */
export const DEFAULT_PREFECTURE = '愛知県';

export const PREFECTURE_OPTIONS = [DEFAULT_PREFECTURE] as const;

/**
 * Cities served by SpotService.loadProductionSpots().
 * Keep in sync with server city loaders.
 */
export const AICHI_CITIES = [
  '刈谷市',
  '長久手市',
  '豊田市',
  '名古屋市',
  '安城市',
  '岡崎市',
] as const;

export type AichiCity = (typeof AICHI_CITIES)[number];
