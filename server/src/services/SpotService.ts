import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  KARIYA_SOURCE,
  parseKariyaTourismCsv,
} from '../mappers/KariyaMapper';
import type { SpotCandidate } from '../models/SpotCandidate';
import {
  inspectSpotCandidates,
  type SpotInspectionResult,
} from '../validation/inspectSpotCandidates';

/**
 * Spot data access layer.
 * Today: sample JSON + Kariya tourism CSV.
 * Later: compose Nagakute / Toyota / OSM / Places here,
 * while always returning SpotCandidate[].
 */
export class SpotService {
  /**
   * Load local sample spots.
   * Replace this implementation later without changing callers' expected type.
   */
  loadSampleSpots(): SpotCandidate[] {
    const filePath = path.join(
      __dirname,
      '../data/spots/sample-spots.json'
    );
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as SpotCandidate[];
    return parsed;
  }

  /**
   * Load Kariya city tourism open data (CSV → SpotCandidate[]).
   * File I/O stays here; CSV parsing/mapping is delegated to KariyaMapper.
   */
  loadKariyaSpots(): SpotCandidate[] {
    const filePath = path.join(
      __dirname,
      '../data/opendata/kariya-tourism.csv'
    );
    const raw = readFileSync(filePath, 'utf8');
    return parseKariyaTourismCsv(raw);
  }

  /**
   * Quality-check Kariya SpotCandidate[] before AI/prompt wiring.
   * Does not change loadKariyaSpots() return type or recommendation flow.
   */
  inspectKariyaSpots(): SpotInspectionResult {
    const spots = this.loadKariyaSpots();
    return inspectSpotCandidates(spots, {
      expectedSources: [KARIYA_SOURCE],
      label: 'Kariya spot data inspection',
      log: true,
    });
  }
}
