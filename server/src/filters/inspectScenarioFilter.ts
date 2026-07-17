import type { SpotCandidate } from '../models/SpotCandidate';
import type { ScoredSpotCandidate } from './ScenarioFilter';

export type ScenarioFilterInspectionSummary = {
  inputCount: number;
  outputCount: number;
  ranked: Array<{
    id: string;
    name: string;
    score: number;
    reasons: string[];
    confidence?: string;
    indoor?: boolean;
    parking?: boolean;
    costLevel?: string;
  }>;
};

/**
 * Compact ScenarioFilter inspection for developers (opt-in logging).
 * Does not throw; safe for recommendation path when log=false.
 */
export function inspectScenarioFilterResult(
  inputSpots: SpotCandidate[],
  scored: ScoredSpotCandidate[],
  options: { label?: string; log?: boolean } = {}
): ScenarioFilterInspectionSummary {
  const label = options.label ?? 'ScenarioFilter inspection';
  const shouldLog = options.log ?? false;

  const summary: ScenarioFilterInspectionSummary = {
    inputCount: inputSpots.length,
    outputCount: scored.length,
    ranked: scored.map((entry) => ({
      id: entry.spot.id,
      name: entry.spot.name,
      score: entry.score,
      reasons: entry.reasons,
      confidence: entry.spot.confidence,
      indoor: entry.spot.indoor,
      parking: entry.spot.parking,
      costLevel: entry.spot.costLevel,
    })),
  };

  if (shouldLog) {
    console.log(label);
    console.log(`- input candidates: ${summary.inputCount}`);
    console.log(`- output candidates: ${summary.outputCount}`);
    console.log('- ranked:');
    for (const row of summary.ranked) {
      const attrs = [
        `indoor=${row.indoor === undefined ? 'unknown' : String(row.indoor)}`,
        `confidence=${row.confidence ?? 'unknown'}`,
        `parking=${row.parking === undefined ? 'unknown' : String(row.parking)}`,
        `costLevel=${row.costLevel ?? 'unknown'}`,
      ].join(', ');
      const reasonText =
        row.reasons.length > 0 ? row.reasons.join(' / ') : '(none)';
      console.log(
        `  - [${row.score}] ${row.name} (${row.id}) | ${attrs} | ${reasonText}`
      );
    }
  }

  return summary;
}
