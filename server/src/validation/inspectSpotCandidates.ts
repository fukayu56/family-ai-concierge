import type { SpotCandidate } from '../models/SpotCandidate';

export type SpotInspectionIssue = {
  spot: SpotCandidate;
  reasons: string[];
};

export type SpotInspectionSummary = {
  total: number;
  valid: number;
  invalid: number;
  missingName: number;
  missingAddress: number;
  missingCoordinates: number;
  duplicateIds: number;
  duplicateNameAddress: number;
  categories: Record<string, number>;
};

export type SpotInspectionResult = {
  validSpots: SpotCandidate[];
  invalidSpots: SpotInspectionIssue[];
  summary: SpotInspectionSummary;
};

export type SpotInspectionOptions = {
  /** Accepted values for SpotCandidate.source */
  expectedSources?: string[];
  /** Label used in the summary log header */
  label?: string;
  /** When true, print summary and compact per-spot error logs */
  log?: boolean;
};

/**
 * Inspect SpotCandidate[] quality before AI/prompt use.
 * Does not throw on invalid rows; returns valid/invalid split + summary.
 */
export function inspectSpotCandidates(
  spots: SpotCandidate[],
  options: SpotInspectionOptions = {}
): SpotInspectionResult {
  const expectedSources = options.expectedSources ?? [];
  const label = options.label ?? 'Spot data inspection';
  const shouldLog = options.log ?? true;

  const reasonsByIndex: string[][] = spots.map(() => []);

  const idCounts = new Map<string, number>();
  const nameAddressCounts = new Map<string, number>();

  for (const spot of spots) {
    const idKey = spot.id?.trim() ?? '';
    if (idKey !== '') {
      idCounts.set(idKey, (idCounts.get(idKey) ?? 0) + 1);
    }

    const nameKey = spot.name?.trim() ?? '';
    const addressKey = spot.address?.trim() ?? '';
    if (nameKey !== '' && addressKey !== '') {
      const pairKey = `${nameKey}@@${addressKey}`;
      nameAddressCounts.set(pairKey, (nameAddressCounts.get(pairKey) ?? 0) + 1);
    }
  }

  let missingName = 0;
  let missingAddress = 0;
  let missingCoordinates = 0;
  let duplicateIds = 0;
  let duplicateNameAddress = 0;
  const categories: Record<string, number> = {};

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const reasons = reasonsByIndex[i];

    if (!isNonEmptyString(spot.id)) {
      reasons.push('id is empty');
    }

    if (!isNonEmptyString(spot.name)) {
      reasons.push('name is empty');
      missingName += 1;
    }

    if (!isNonEmptyString(spot.category)) {
      reasons.push('category is empty');
    }

    if (!isNonEmptyString(spot.address)) {
      reasons.push('address is empty');
      missingAddress += 1;
    }

    if (
      expectedSources.length > 0 &&
      !expectedSources.includes(spot.source)
    ) {
      reasons.push(
        `source is "${spot.source}" (expected: ${expectedSources.join(' | ')})`
      );
    }

    const hasLatitude = spot.latitude !== undefined;
    const hasLongitude = spot.longitude !== undefined;

    if (!hasLatitude || !hasLongitude) {
      missingCoordinates += 1;
    }

    if (hasLatitude) {
      if (!Number.isFinite(spot.latitude)) {
        reasons.push('latitude is not a finite number');
      } else if (spot.latitude! < -90 || spot.latitude! > 90) {
        reasons.push('latitude is out of range (-90..90)');
      }
    }

    if (hasLongitude) {
      if (!Number.isFinite(spot.longitude)) {
        reasons.push('longitude is not a finite number');
      } else if (spot.longitude! < -180 || spot.longitude! > 180) {
        reasons.push('longitude is out of range (-180..180)');
      }
    }

    const idKey = spot.id?.trim() ?? '';
    if (idKey !== '' && (idCounts.get(idKey) ?? 0) > 1) {
      reasons.push('duplicate id');
      duplicateIds += 1;
    }

    const nameKey = spot.name?.trim() ?? '';
    const addressKey = spot.address?.trim() ?? '';
    if (nameKey !== '' && addressKey !== '') {
      const pairKey = `${nameKey}@@${addressKey}`;
      if ((nameAddressCounts.get(pairKey) ?? 0) > 1) {
        reasons.push('duplicate name+address');
        duplicateNameAddress += 1;
      }
    }

    if (!Array.isArray(spot.tags)) {
      reasons.push('tags is not an array');
    }

    if (spot.description !== undefined && spot.description !== null) {
      if (typeof spot.description !== 'string') {
        reasons.push('description is not a string');
      } else if (spot.description.trim() === '') {
        reasons.push('description is blank');
      }
    }

    const categoryKey = isNonEmptyString(spot.category)
      ? spot.category.trim()
      : '(empty)';
    categories[categoryKey] = (categories[categoryKey] ?? 0) + 1;
  }

  const validSpots: SpotCandidate[] = [];
  const invalidSpots: SpotInspectionIssue[] = [];

  for (let i = 0; i < spots.length; i++) {
    const reasons = reasonsByIndex[i];
    if (reasons.length === 0) {
      validSpots.push(spots[i]);
    } else {
      invalidSpots.push({ spot: spots[i], reasons });
    }
  }

  const summary: SpotInspectionSummary = {
    total: spots.length,
    valid: validSpots.length,
    invalid: invalidSpots.length,
    missingName,
    missingAddress,
    missingCoordinates,
    duplicateIds,
    duplicateNameAddress,
    categories,
  };

  if (shouldLog) {
    logInspection(label, summary, invalidSpots);
  }

  return { validSpots, invalidSpots, summary };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function logInspection(
  label: string,
  summary: SpotInspectionSummary,
  invalidSpots: SpotInspectionIssue[]
): void {
  console.log(label);
  console.log(`- total: ${summary.total}`);
  console.log(`- valid: ${summary.valid}`);
  console.log(`- invalid: ${summary.invalid}`);
  console.log(`- missing name: ${summary.missingName}`);
  console.log(`- missing address: ${summary.missingAddress}`);
  console.log(`- missing coordinates: ${summary.missingCoordinates}`);
  console.log(`- duplicate ids: ${summary.duplicateIds}`);
  console.log(`- duplicate name/address: ${summary.duplicateNameAddress}`);
  console.log('- categories:');

  const categoryEntries = Object.entries(summary.categories).sort((a, b) =>
    a[0].localeCompare(b[0], 'ja')
  );
  for (const [category, count] of categoryEntries) {
    console.log(`  - ${category}: ${count}`);
  }

  for (const issue of invalidSpots) {
    const id = issue.spot.id?.trim() || '(no id)';
    const name = issue.spot.name?.trim() || '(no name)';
    console.log(
      `invalid spot: id=${id} name=${name} reasons=${issue.reasons.join('; ')}`
    );
  }
}
