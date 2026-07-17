/**
 * Category normalization for SpotCandidate across municipalities.
 * Prefer existing Kariya categories; extend only when needed.
 */
export function normalizeSpotCategory(name: string, rawHint = ''): string {
  const text = `${name} ${rawHint}`;

  if (
    /児童遊園|ちびっこ|遊具広場|プレイグラウンド/i.test(text)
  ) {
    return 'playground';
  }
  if (/動物園|水族館|どうぶつ|ふれあい動物/.test(text)) {
    return 'zoo';
  }
  if (/科学館|プラネタリウム|サイエンス/.test(text)) {
    return 'museum';
  }
  if (/図書館|ライブラリー/.test(text)) {
    return 'library';
  }
  if (
    /公園|パーク|庭園|緑地|広場|ガーデン|河川敷/.test(text)
  ) {
    return 'park';
  }
  if (
    /博物館|美術館|資料館|記念館|展示室|郷土/.test(text)
  ) {
    return 'museum';
  }
  if (/体験|工作|アトリエ|工房/.test(text)) {
    return 'experience';
  }
  if (/カフェ|喫茶/.test(text)) {
    return 'cafe';
  }
  if (/城|観光|展望|温泉|渓|古戦場/.test(text)) {
    return 'sightseeing';
  }
  return 'other';
}

/**
 * Safe indoor inference (same spirit as KariyaMapper).
 * Does not invent parking/cost/hours.
 */
export function applySafeIndoorInference(spot: {
  name: string;
  category?: string;
  indoor?: boolean;
  confidence?: 'verified' | 'inferred' | 'unknown';
}): void {
  if (spot.indoor !== undefined) {
    return;
  }
  const name = spot.name;
  if (name.includes('科学館') || name.includes('博物館') || name.includes('美術館') || name.includes('図書館')) {
    spot.indoor = true;
    spot.confidence = 'inferred';
    return;
  }
  if (
    name.includes('公園') ||
    name.includes('広場') ||
    name.includes('緑地') ||
    name.includes('児童遊園') ||
    name.includes('庭園')
  ) {
    spot.indoor = false;
    spot.confidence = 'inferred';
  }
}
