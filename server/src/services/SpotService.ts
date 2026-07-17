import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  KARIYA_SOURCE,
  parseKariyaTourismCsv,
} from '../mappers/KariyaMapper';
import { parseCuratedSpotsJson } from '../mappers/CuratedSpotsMapper';
import {
  NAGAKUTE_SOURCE,
  parseNagakuteParksCsv,
  parseNagakuteTourismCsv,
} from '../mappers/NagakuteMapper';
import {
  NAGOYA_PARK_SOURCE,
  parseNagoyaParkCsvFiles,
} from '../mappers/NagoyaParkMapper';
import {
  TOYOTA_SOURCE,
  parseToyotaChiikiHirobaCsv,
} from '../mappers/ToyotaMapper';
import type { SpotCandidate } from '../models/SpotCandidate';
import {
  inspectSpotCandidates,
  type SpotInspectionResult,
} from '../validation/inspectSpotCandidates';
import {
  mergeAndDeduplicateSpots,
  type MergeDedupeResult,
} from './mergeSpots';

export type ProductionSpotsLoadResult = {
  spots: SpotCandidate[];
  merge: MergeDedupeResult;
  byCity: Record<string, number>;
  mapperErrors: string[];
};

/**
 * Spot data access layer.
 * Production recommendation uses loadProductionSpots() (no fictional sample).
 * loadSampleSpots() remains for inspection/tests.
 */
export class SpotService {
  private readonly dataRoot = path.join(__dirname, '../data');

  /**
   * Load local sample spots (may include fictional places).
   * Not used by production recommendation merge.
   */
  loadSampleSpots(): SpotCandidate[] {
    const filePath = path.join(this.dataRoot, 'spots/sample-spots.json');
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as SpotCandidate[];
  }

  loadKariyaSpots(): SpotCandidate[] {
    const filePath = path.join(this.dataRoot, 'opendata/kariya-tourism.csv');
    const raw = readFileSync(filePath, 'utf8');
    return parseKariyaTourismCsv(raw);
  }

  inspectKariyaSpots(): SpotInspectionResult {
    const spots = this.loadKariyaSpots();
    return inspectSpotCandidates(spots, {
      expectedSources: [KARIYA_SOURCE],
      label: 'Kariya spot data inspection',
      log: true,
    });
  }

  loadNagakuteSpots(): SpotCandidate[] {
    const dir = path.join(this.dataRoot, 'spots/nagakute');
    const tourism = readFileSync(path.join(dir, 'tourism.csv'), 'utf8');
    const parks = readFileSync(path.join(dir, 'parks.utf8.csv'), 'utf8');
    return [
      ...parseNagakuteTourismCsv(tourism),
      ...parseNagakuteParksCsv(parks),
    ];
  }

  loadToyotaSpots(): SpotCandidate[] {
    const dir = path.join(this.dataRoot, 'spots/toyota');
    const plazas = readFileSync(path.join(dir, 'chiikihiroba.csv'), 'utf8');
    const curated = readFileSync(path.join(dir, 'curated-spots.json'), 'utf8');
    return [
      ...parseToyotaChiikiHirobaCsv(plazas),
      ...parseCuratedSpotsJson(curated),
    ];
  }

  loadNagoyaSpots(): SpotCandidate[] {
    const dir = path.join(this.dataRoot, 'spots/nagoya');
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.utf8.csv'))
      .map((name) => ({
        name,
        text: readFileSync(path.join(dir, name), 'utf8'),
      }));
    const parks = parseNagoyaParkCsvFiles(files);
    const curated = parseCuratedSpotsJson(
      readFileSync(path.join(dir, 'curated-spots.json'), 'utf8')
    );
    return [...parks, ...curated];
  }

  loadAnjoSpots(): SpotCandidate[] {
    const filePath = path.join(
      this.dataRoot,
      'spots/anjo/curated-spots.json'
    );
    return parseCuratedSpotsJson(readFileSync(filePath, 'utf8'));
  }

  loadOkazakiSpots(): SpotCandidate[] {
    const filePath = path.join(
      this.dataRoot,
      'spots/okazaki/curated-spots.json'
    );
    return parseCuratedSpotsJson(readFileSync(filePath, 'utf8'));
  }

  /**
   * Merge 6 cities (no fictional sample) + lightweight dedupe.
   * Safe to call on each request; reads local files only.
   */
  loadProductionSpots(): ProductionSpotsLoadResult {
    const mapperErrors: string[] = [];
    const groups: SpotCandidate[][] = [];

    const loaders: Array<{ city: string; load: () => SpotCandidate[] }> = [
      { city: '刈谷市', load: () => this.loadKariyaSpots() },
      { city: '長久手市', load: () => this.loadNagakuteSpots() },
      { city: '豊田市', load: () => this.loadToyotaSpots() },
      { city: '名古屋市', load: () => this.loadNagoyaSpots() },
      { city: '安城市', load: () => this.loadAnjoSpots() },
      { city: '岡崎市', load: () => this.loadOkazakiSpots() },
    ];

    const byCity: Record<string, number> = {};
    for (const entry of loaders) {
      try {
        const spots = entry.load();
        groups.push(spots);
        byCity[entry.city] = spots.length;
        if (spots.length === 0) {
          console.warn(`[SpotService] WARNING: ${entry.city} loaded 0 spots`);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        mapperErrors.push(`${entry.city}: ${message}`);
        byCity[entry.city] = 0;
        console.warn(`[SpotService] mapper error for ${entry.city}: ${message}`);
      }
    }

    const merge = mergeAndDeduplicateSpots(groups);
    return { spots: merge.spots, merge, byCity, mapperErrors };
  }

  /**
   * Full production inspection (cities / sources / categories / Phase A).
   */
  inspectProductionSpots(options: { log?: boolean } = {}): SpotInspectionResult & {
    merge: MergeDedupeResult;
    byCity: Record<string, number>;
    mapperErrors: string[];
  } {
    const loaded = this.loadProductionSpots();
    const inspection = inspectSpotCandidates(loaded.spots, {
      label: 'Production spots inspection (6 cities)',
      log: options.log ?? true,
      expectedSources: [
        KARIYA_SOURCE,
        NAGAKUTE_SOURCE,
        TOYOTA_SOURCE,
        NAGOYA_PARK_SOURCE,
        'curated-official',
      ],
    });
    return {
      ...inspection,
      merge: loaded.merge,
      byCity: loaded.byCity,
      mapperErrors: loaded.mapperErrors,
    };
  }
}
