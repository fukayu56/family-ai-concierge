import type { SpotCandidate } from '../models/SpotCandidate';

export type DedupeConflict = {
  key: string;
  keptId: string;
  droppedId: string;
  reason: string;
  fieldConflicts: string[];
};

export type MergeDedupeResult = {
  spots: SpotCandidate[];
  beforeCount: number;
  afterCount: number;
  duplicatePairs: number;
  conflicts: DedupeConflict[];
};

/**
 * Normalize name/address for lightweight duplicate keys.
 * TECH_DEBT: provisional — move to dedicated Merge/Deduplicate module when
 * multi-source conflicts exceed simple city+name+address matching, or when
 * geohash proximity rules become necessary beyond optional lat/lng assist.
 */
export function normalizeSpotKeyPart(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[　]/g, '')
    .replace(/[・･.。．,，、()（）「」『』【】[\]]/g, '')
    .replace(/株式会社|有限会社/g, '');
}

export function buildDedupeKey(spot: SpotCandidate): string {
  const city = normalizeSpotKeyPart(spot.city ?? '');
  const name = normalizeSpotKeyPart(spot.name);
  const address = normalizeSpotKeyPart(spot.address);
  return `${city}|${name}|${address}`;
}

function sourceRank(source: string): number {
  if (source.includes('open-data') || source.includes('opendata')) return 3;
  if (source.includes('curated-official') || source.includes('official')) return 2;
  if (source === 'sample') return 0;
  return 1;
}

function preferSpot(a: SpotCandidate, b: SpotCandidate): SpotCandidate {
  const rankDiff = sourceRank(b.source) - sourceRank(a.source);
  if (rankDiff > 0) return mergeFill(b, a);
  if (rankDiff < 0) return mergeFill(a, b);
  if (b.verified === true && a.verified !== true) return mergeFill(b, a);
  if (a.verified === true && b.verified !== true) return mergeFill(a, b);
  return mergeFill(a, b);
}

/** Fill undefined fields from donor; never overwrite conflicting known values. */
function mergeFill(
  primary: SpotCandidate,
  donor: SpotCandidate
): SpotCandidate {
  const out: SpotCandidate = { ...primary, tags: [...(primary.tags ?? [])] };
  const fillKeys: Array<keyof SpotCandidate> = [
    'description',
    'latitude',
    'longitude',
    'indoor',
    'parking',
    'costLevel',
    'confidence',
    'city',
    'sourceUrl',
  ];
  for (const key of fillKeys) {
    const primaryValue = out[key];
    const donorValue = donor[key];
    if (primaryValue === undefined && donorValue !== undefined) {
      Object.assign(out, { [key]: donorValue });
    }
  }
  return out;
}

function collectConflicts(
  kept: SpotCandidate,
  dropped: SpotCandidate
): string[] {
  const conflicts: string[] = [];
  const keys: Array<keyof SpotCandidate> = [
    'indoor',
    'parking',
    'costLevel',
    'latitude',
    'longitude',
  ];
  for (const key of keys) {
    const a = kept[key];
    const b = dropped[key];
    if (a !== undefined && b !== undefined && a !== b) {
      conflicts.push(`${String(key)}: kept=${String(a)} dropped=${String(b)}`);
    }
  }
  return conflicts;
}

/**
 * Merge spot lists and remove obvious duplicates (city+name+address).
 * Does not delete all near-duplicates with different addresses.
 */
export function mergeAndDeduplicateSpots(
  groups: SpotCandidate[][]
): MergeDedupeResult {
  const flat = groups.flat();
  const beforeCount = flat.length;
  const byKey = new Map<string, SpotCandidate>();
  const conflicts: DedupeConflict[] = [];
  let duplicatePairs = 0;

  for (const spot of flat) {
    if (!spot.name?.trim()) continue;
    const key = buildDedupeKey(spot);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, spot);
      continue;
    }
    duplicatePairs += 1;
    const kept = preferSpot(existing, spot);
    const dropped = kept.id === existing.id ? spot : existing;
    const fieldConflicts = collectConflicts(kept, dropped);
    conflicts.push({
      key,
      keptId: kept.id,
      droppedId: dropped.id,
      reason: 'same city+normalized name+address',
      fieldConflicts,
    });
    byKey.set(key, kept);
  }

  return {
    spots: [...byKey.values()],
    beforeCount,
    afterCount: byKey.size,
    duplicatePairs,
    conflicts,
  };
}
