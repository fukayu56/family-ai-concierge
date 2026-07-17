/**
 * Shared minimal CSV helpers for municipal open-data mappers.
 *
 * TECH_DEBT: duplicated with KariyaMapper.parseCsv — extract once city mappers stabilize.
 */

export function parseCsv(text: string): string[][] {
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

export function getCell(row: string[], index: number): string {
  if (index < 0 || index >= row.length) {
    return '';
  }
  return row[index] ?? '';
}

export function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/,/g, '')
    .replace(/ｍ|m|㎡|ha/gi, '');
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}
