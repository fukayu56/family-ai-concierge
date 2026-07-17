import type { SpotCandidate } from '../models/SpotCandidate';
import { applySafeIndoorInference, normalizeSpotCategory } from './categoryNormalize';
import {
  getCell,
  parseCsv,
  parseOptionalNumber,
  stripBom,
} from './csvUtils';

export const TOYOTA_SOURCE = 'toyota-open-data';
const TOYOTA_PARKS_CATALOG =
  'https://data.bodik.jp/dataset/232114_urban_parks';
const TOYOTA_LAST_UPDATED = '2024-03-31';
/** Prefer larger plazas for weekend family use (㎡). */
const MIN_PLAZA_AREA_M2 = 2_000;

/**
 * Toyota regional plaza / playground CSV → SpotCandidate[].
 * TECH_DEBT: park-biased; culture/tourism come from curated overlay.
 */
export function parseToyotaChiikiHirobaCsv(csvText: string): SpotCandidate[] {
  const rows = parseCsv(stripBom(csvText));
  if (rows.length < 3) return [];

  // Row0: title, Row1: header
  const header = rows[1].map((c) => c.trim());
  const indexOf = (name: string) => header.indexOf(name);
  const col = {
    type: indexOf('広場区分'),
    name: indexOf('広場名'),
    area: indexOf('広場全体面積'),
    address: indexOf('所在地'),
  };

  const spots: SpotCandidate[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const name = getCell(row, col.name).trim();
    if (!name) continue;
    const area = parseOptionalNumber(getCell(row, col.area));
    if (area == null || area < MIN_PLAZA_AREA_M2) continue;

    const type = getCell(row, col.type).trim();
    const addressRaw = getCell(row, col.address).trim();
    const address = addressRaw.startsWith('愛知県')
      ? addressRaw
      : `愛知県豊田市${addressRaw}`;

    const spot: SpotCandidate = {
      id: `toyota-plaza-${i}`,
      name,
      category: normalizeSpotCategory(name, type),
      city: '豊田市',
      address,
      description: type
        ? `豊田市の${type}（公式オープンデータ・面積約${Math.round(area)}㎡）`
        : '',
      tags: type ? [type, `area_m2:${Math.round(area)}`] : [],
      source: TOYOTA_SOURCE,
      sourceUrl: TOYOTA_PARKS_CATALOG,
      lastUpdated: TOYOTA_LAST_UPDATED,
    };
    applySafeIndoorInference(spot);
    spots.push(spot);
  }
  return spots;
}
