import type { SpotCandidate } from '../models/SpotCandidate';
import { applySafeIndoorInference, normalizeSpotCategory } from './categoryNormalize';
import {
  getCell,
  parseCsv,
  parseOptionalNumber,
  stripBom,
} from './csvUtils';

export const NAGOYA_PARK_SOURCE = 'nagoya-open-data-parks';
const NAGOYA_PARK_CATALOG =
  'https://www.city.nagoya.jp/kurashi/douro/1014853/1014871.html';
const NAGOYA_LAST_UPDATED = '2024-04-01';
/** Avoid flooding Prompt with tiny neighborhood parks (hectares). */
const MIN_PARK_AREA_HA = 1.0;

/**
 * Shared mapper for Nagoya ward urban-park CSVs (same column layout).
 * TECH_DEBT: do not fork per-ward mappers; keep this shared.
 * Culture/indoor facilities are supplied via curated JSON overlay.
 */
export function parseNagoyaParkCsv(
  csvText: string,
  options: { wardHint?: string } = {}
): SpotCandidate[] {
  const rows = parseCsv(stripBom(csvText));
  if (rows.length === 0) return [];

  let headerIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join(',');
    if (joined.includes('No.') && joined.includes('名')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return [];

  const header = rows[headerIndex].map((c) => c.trim());
  // Columns are typically: No., 名称, 所在地, 面積(ha), 開園年度
  const nameIdx = header.findIndex((h) => h.includes('名'));
  const addressIdx = header.findIndex((h) => h.includes('所'));
  const areaIdx = header.findIndex((h) => h.includes('面積') || h.includes('ha'));
  const noIdx = header.findIndex((h) => h.includes('No'));

  const spots: SpotCandidate[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => c.trim() === '')) continue;
    const name = getCell(row, nameIdx >= 0 ? nameIdx : 1).trim();
    if (!name || name === '名称') continue;
    // Skip section headers like "2.緑地"
    if (/^\d+\./.test(name) || name.includes('都市公園')) continue;

    const area = parseOptionalNumber(
      getCell(row, areaIdx >= 0 ? areaIdx : 3)
    );
    if (area == null || area < MIN_PARK_AREA_HA) continue;

    const no = getCell(row, noIdx >= 0 ? noIdx : 0).trim();
    const addressRaw = getCell(row, addressIdx >= 0 ? addressIdx : 2).trim();
    const address = addressRaw.includes('名古屋市')
      ? addressRaw
      : `名古屋市${addressRaw}`;
    const ward =
      options.wardHint ||
      (address.match(/名古屋市([^\d]+区)/)?.[1]
        ? `名古屋市${address.match(/名古屋市([^\d]+区)/)?.[1]}`
        : '名古屋市');

    const idSuffix = no || `r${i}`;
    const spot: SpotCandidate = {
      id: `nagoya-park-${ward}-${idSuffix}`.replace(/\s+/g, ''),
      name,
      category: normalizeSpotCategory(name),
      city: '名古屋市',
      address,
      description: `名古屋市都市公園（公式オープンデータ・約${area}ha）`,
      tags: [`area_ha:${area}`, ward],
      source: NAGOYA_PARK_SOURCE,
      sourceUrl: NAGOYA_PARK_CATALOG,
      lastUpdated: NAGOYA_LAST_UPDATED,
    };
    applySafeIndoorInference(spot);
    spots.push(spot);
  }
  return spots;
}

export function parseNagoyaParkCsvFiles(
  files: Array<{ name: string; text: string }>
): SpotCandidate[] {
  const all: SpotCandidate[] = [];
  for (const file of files) {
    const wardHint = guessWardFromFilename(file.name);
    all.push(...parseNagoyaParkCsv(file.text, { wardHint }));
  }
  return all;
}

function guessWardFromFilename(name: string): string | undefined {
  const map: Record<string, string> = {
    chikusa: '千種区',
    higashi: '東区',
    naka: '中区',
    showa: '昭和区',
    mizuho: '瑞穂区',
    atsuta: '熱田区',
    minato: '港区',
    midori: '緑区',
    meito: '名東区',
    tenpaku: '天白区',
  };
  for (const [key, ward] of Object.entries(map)) {
    if (name.includes(key)) return ward;
  }
  return undefined;
}
