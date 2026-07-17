import type { SpotCandidate } from '../models/SpotCandidate';
import { applySafeIndoorInference, normalizeSpotCategory } from './categoryNormalize';
import {
  getCell,
  parseCsv,
  parseOptionalNumber,
  stripBom,
} from './csvUtils';

export const NAGAKUTE_SOURCE = 'nagakute-open-data';
const NAGAKUTE_CATALOG =
  'https://www.city.nagakute.lg.jp/soshiki/shichokoshitsu/johoka/2/2/opendata/ichiran/18072.html';
const NAGAKUTE_LAST_UPDATED = '2026-07-13';
/** Keep larger parks only for family outing usefulness (㎡). */
const MIN_PARK_AREA_M2 = 3_000;

/**
 * Nagakute official tourism CSV (自治体標準セット寄り) → SpotCandidate[].
 */
export function parseNagakuteTourismCsv(csvText: string): SpotCandidate[] {
  const rows = parseCsv(stripBom(csvText));
  if (rows.length < 2) {
    return [];
  }
  const header = rows[0].map((c) => c.trim());
  const indexOf = (name: string) => header.indexOf(name);
  const col = {
    no: indexOf('NO'),
    name: indexOf('名称'),
    address: indexOf('住所'),
    detail: indexOf('方書'),
    lat: indexOf('緯度'),
    lng: indexOf('経度'),
    description: indexOf('説明'),
    url: indexOf('URL'),
    note: indexOf('備考'),
  };

  const spots: SpotCandidate[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => c.trim() === '')) continue;
    const name = getCell(row, col.name).trim();
    if (!name) continue;
    const no = getCell(row, col.no).trim();
    const addressBase = getCell(row, col.address).trim();
    const detail = getCell(row, col.detail).trim();
    const address =
      detail !== '' ? `${addressBase} ${detail}`.trim() : addressBase;
    const spot: SpotCandidate = {
      id: no ? `nagakute-tourism-${no}` : `nagakute-tourism-row-${i}`,
      name,
      category: normalizeSpotCategory(name),
      city: '長久手市',
      address,
      description: getCell(row, col.description).trim(),
      tags: [],
      source: NAGAKUTE_SOURCE,
      sourceUrl: getCell(row, col.url).trim() || NAGAKUTE_CATALOG,
      lastUpdated: NAGAKUTE_LAST_UPDATED,
    };
    const note = getCell(row, col.note).trim();
    if (note) spot.tags = [note];
    const lat = parseOptionalNumber(getCell(row, col.lat));
    const lng = parseOptionalNumber(getCell(row, col.lng));
    if (lat != null) spot.latitude = lat;
    if (lng != null) spot.longitude = lng;
    applySafeIndoorInference(spot);
    spots.push(spot);
  }
  return spots;
}

/**
 * Nagakute park list CSV → SpotCandidate[] (area-filtered).
 */
export function parseNagakuteParksCsv(csvText: string): SpotCandidate[] {
  const rows = parseCsv(stripBom(csvText));
  if (rows.length < 2) return [];
  const header = rows[0].map((c) => c.trim());
  const indexOf = (name: string) => header.findIndex((h) => h.includes(name));
  const col = {
    id: indexOf('識別'),
    kind: indexOf('種別'),
    name: indexOf('名称'),
    address: indexOf('住所'),
    lat: indexOf('緯度'),
    lng: indexOf('経度'),
    area: indexOf('面積'),
  };

  const spots: SpotCandidate[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = getCell(row, col.name).trim();
    if (!name) continue;
    const areaRaw = parseOptionalNumber(getCell(row, col.area));
    // File header says ㎡ but values are typically hectares (e.g. 0.27).
    let areaM2 = areaRaw;
    if (areaRaw != null && areaRaw > 0 && areaRaw < 50) {
      areaM2 = areaRaw * 10_000;
    }
    if (areaM2 != null && areaM2 < MIN_PARK_AREA_M2) continue;

    const idRaw = getCell(row, col.id).trim() || `row-${i}`;
    const kind = getCell(row, col.kind).trim();
    const spot: SpotCandidate = {
      id: `nagakute-park-${idRaw}`,
      name,
      category: normalizeSpotCategory(name, kind),
      city: '長久手市',
      address: getCell(row, col.address).trim(),
      description: kind ? `長久手市の${kind}（公式オープンデータ）` : '',
      tags: kind ? [kind] : [],
      source: NAGAKUTE_SOURCE,
      sourceUrl: NAGAKUTE_CATALOG,
      lastUpdated: '2022-10-07',
    };
    const lat = parseOptionalNumber(getCell(row, col.lat));
    const lng = parseOptionalNumber(getCell(row, col.lng));
    if (lat != null) spot.latitude = lat;
    if (lng != null) spot.longitude = lng;
    applySafeIndoorInference(spot);
    spots.push(spot);
  }
  return spots;
}
