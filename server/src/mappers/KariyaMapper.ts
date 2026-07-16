import type { SpotCandidate } from '../models/SpotCandidate';

/**
 * Kariya city tourism facilities CSV → SpotCandidate
 *
 * Column mapping (自治体標準オープンデータセット寄り):
 * - NO              → id（`kariya-{NO}`）
 * - 名称            → name
 * - （カテゴリ列なし）→ category（名称キーワードから簡易推定。不明は `other`）
 * - 住所 + 方書     → address
 * - 緯度            → latitude（空なら省略）
 * - 経度            → longitude（空なら省略）
 * - 説明            → description
 * - 備考            → tags（あれば1要素）
 * - （固定）        → source: `kariya-open-data`
 * - URL             → sourceUrl（空ならカタログURL）
 * - （CSVに列なし） → lastUpdated: 公開基準日 `2026-04-01`
 *
 * Unused in SpotCandidate (kept for future mappers / enrichment):
 * 市区町村コード, 都道府県名, 市区町村名, 名称_カナ, 名称_英語, POIコード,
 * 利用可能曜日, 開始時間, 終了時間, 利用可能日時特記事項,
 * 料金（基本）, 料金（詳細）, 説明_英語, アクセス方法, 駐車場情報,
 * バリアフリー情報, 連絡先*, 画像*
 */
export const KARIYA_SOURCE = 'kariya-open-data';
const KARIYA_CATALOG_URL =
  'https://www.city.kariya.lg.jp/shisei/opendata/1007323/index.html';
/** Dataset as-of date from Kariya open data listing (令和8年4月1日). */
const KARIYA_LAST_UPDATED = '2026-04-01';
const DEFAULT_CATEGORY = 'other';

/**
 * Parse Kariya tourism CSV text into SpotCandidate[].
 * Accepts UTF-8 text (BOM allowed). Does not read files.
 */
export function parseKariyaTourismCsv(csvText: string): SpotCandidate[] {
  const text = csvText.replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((cell) => cell.trim());
  const indexOf = (name: string): number => header.indexOf(name);

  const col = {
    no: indexOf('NO'),
    name: indexOf('名称'),
    address: indexOf('住所'),
    addressDetail: indexOf('方書'),
    latitude: indexOf('緯度'),
    longitude: indexOf('経度'),
    description: indexOf('説明'),
    url: indexOf('URL'),
    note: indexOf('備考'),
  };

  const spots: SpotCandidate[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => cell.trim() === '')) {
      continue;
    }

    const name = getCell(row, col.name).trim();
    if (name === '') {
      continue;
    }

    const no = getCell(row, col.no).trim();
    const addressBase = getCell(row, col.address).trim();
    const addressDetail = getCell(row, col.addressDetail).trim();
    const address =
      addressDetail !== ''
        ? `${addressBase} ${addressDetail}`.trim()
        : addressBase;

    const latitude = parseOptionalNumber(getCell(row, col.latitude));
    const longitude = parseOptionalNumber(getCell(row, col.longitude));
    const description = getCell(row, col.description).trim();
    const url = getCell(row, col.url).trim();
    const note = getCell(row, col.note).trim();

    const spot: SpotCandidate = {
      id: no !== '' ? `kariya-${no}` : `kariya-row-${i}`,
      name,
      category: inferKariyaCategory(name),
      address,
      description,
      tags: note !== '' ? [note] : [],
      source: KARIYA_SOURCE,
      sourceUrl: url !== '' ? url : KARIYA_CATALOG_URL,
      lastUpdated: KARIYA_LAST_UPDATED,
    };

    if (latitude != null) {
      spot.latitude = latitude;
    }
    if (longitude != null) {
      spot.longitude = longitude;
    }

    spots.push(spot);
  }

  return spots;
}

/**
 * Obvious name-keyword mapping only.
 * Broader taxonomy redesign is deferred.
 */
function inferKariyaCategory(name: string): string {
  if (
    name.includes('公園') ||
    name.includes('パーク') ||
    name.includes('ガーデン')
  ) {
    return 'park';
  }
  if (
    name.includes('博物館') ||
    name.includes('美術館') ||
    name.includes('資料館') ||
    name.includes('記念館') ||
    name.includes('展示室')
  ) {
    return 'museum';
  }
  if (
    name.includes('体験') ||
    name.includes('遊園') ||
    name.includes('科学')
  ) {
    return 'experience';
  }
  if (name.includes('動物園')) {
    return 'zoo';
  }
  if (name.includes('カフェ') || name.includes('喫茶')) {
    return 'cafe';
  }
  return DEFAULT_CATEGORY;
}

function getCell(row: string[], index: number): string {
  if (index < 0 || index >= row.length) {
    return '';
  }
  return row[index] ?? '';
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Minimal RFC4180-ish CSV parser for small municipal open-data files.
 * Supports quoted fields and commas inside quotes. No external dependency.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
