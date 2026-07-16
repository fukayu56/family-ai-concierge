import { parseHhMm } from '../recommendation-business-validation';
import type { Plan } from '../recommendation-response';

export type PlanSimilarityEntry = {
  label: string;
  plan: Plan;
};

/**
 * Normalize spots string into a sorted unique set for comparison.
 * Split on common Japanese/English separators only (no semantic analysis).
 */
export function normalizeSpotSet(spots: string): string[] {
  const parts = spots
    .split(/[、,，・／/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return [...new Set(parts)].sort((a, b) => a.localeCompare(b, 'ja'));
}

function spotSetsEqual(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

/**
 * Lightweight plan similarity inspection.
 * Emits developer warnings only; never fails the request or omits plans.
 */
export function inspectPlanSimilarity(entries: PlanSimilarityEntry[]): void {
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = entries[i];
      const right = entries[j];
      const leftSpots = normalizeSpotSet(left.plan.spots);
      const rightSpots = normalizeSpotSet(right.plan.spots);

      if (spotSetsEqual(leftSpots, rightSpots)) {
        console.warn(
          `[Plan Similarity Warning]\n${left.label} and ${right.label} use the same spot set`
        );
      }
    }
  }
}

/**
 * Log whether a time_relaxed plan actually used earlier departure / later return
 * relative to the original (strict) time window.
 */
export function logTimeRelaxationUsage(
  plan: Plan,
  originalStartTime: string,
  originalEndTime: string
): void {
  const firstDeparture = plan.timeline.find((item) => item.type === 'departure');
  const returnItems = plan.timeline.filter((item) => item.type === 'return');
  const lastReturn =
    returnItems.length > 0 ? returnItems[returnItems.length - 1] : undefined;

  const departureMinutes =
    firstDeparture != null ? parseHhMm(firstDeparture.time) : null;
  const returnMinutes =
    lastReturn != null ? parseHhMm(lastReturn.time) : null;
  const originalStartMinutes = parseHhMm(originalStartTime);
  const originalEndMinutes = parseHhMm(originalEndTime);

  const earlierDepartureUsed =
    departureMinutes != null &&
    originalStartMinutes != null &&
    departureMinutes < originalStartMinutes;
  const laterReturnUsed =
    returnMinutes != null &&
    originalEndMinutes != null &&
    returnMinutes > originalEndMinutes;

  console.log('Time relaxation usage:');
  console.log(`- earlier departure used: ${earlierDepartureUsed}`);
  console.log(`- later return used: ${laterReturnUsed}`);

  if (!earlierDepartureUsed && !laterReturnUsed) {
    console.warn(
      '[Time Relaxation Warning] time_relaxed plan uses neither earlier departure nor later return; added value may be weak'
    );
  }
}
