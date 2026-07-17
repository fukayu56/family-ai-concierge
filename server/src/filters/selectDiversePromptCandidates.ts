import type { ScoredSpotCandidate } from './ScenarioFilter';

/**
 * Prompt-candidate selection with light category diversity.
 * Does NOT change ScenarioFilter scores — only reorders/slices the ranked list.
 *
 * TECH_DEBT: extract to dedicated PromptCandidateSelector when weather-aware
 * diversity rules grow (e.g. rain → allow indoor concentration).
 */
export function selectDiversePromptCandidates(
  scored: ScoredSpotCandidate[],
  options: {
    limit?: number;
    maxPerCategory?: number;
    /** When rainy, do not force outdoor mix. */
    preferIndoorConcentration?: boolean;
  } = {}
): ScoredSpotCandidate[] {
  const limit = options.limit ?? 20;
  const maxPerCategory = options.maxPerCategory ?? 8;
  const preferIndoor = options.preferIndoorConcentration === true;

  if (scored.length <= limit) {
    return scored;
  }

  if (preferIndoor) {
    // Keep score order; only soft-cap identical category after indoor-heavy ranking.
    return takeWithCategoryCap(scored, limit, maxPerCategory);
  }

  // Round-robin across categories while respecting relative score bands.
  const byCategory = new Map<string, ScoredSpotCandidate[]>();
  for (const entry of scored) {
    const cat = entry.spot.category || 'other';
    const list = byCategory.get(cat) ?? [];
    list.push(entry);
    byCategory.set(cat, list);
  }

  const queues = [...byCategory.values()].map((list) => [...list]);
  const selected: ScoredSpotCandidate[] = [];
  const selectedIds = new Set<string>();
  const perCat = new Map<string, number>();

  while (selected.length < limit) {
    let progressed = false;
    for (const queue of queues) {
      if (selected.length >= limit) break;
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (selectedIds.has(next.spot.id)) continue;
        const cat = next.spot.category || 'other';
        const count = perCat.get(cat) ?? 0;
        if (count >= maxPerCategory) continue;
        selected.push(next);
        selectedIds.add(next.spot.id);
        perCat.set(cat, count + 1);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  // Fill remaining by original score order if under limit.
  if (selected.length < limit) {
    for (const entry of scored) {
      if (selected.length >= limit) break;
      if (selectedIds.has(entry.spot.id)) continue;
      selected.push(entry);
      selectedIds.add(entry.spot.id);
    }
  }

  return selected;
}

function takeWithCategoryCap(
  scored: ScoredSpotCandidate[],
  limit: number,
  maxPerCategory: number
): ScoredSpotCandidate[] {
  const selected: ScoredSpotCandidate[] = [];
  const perCat = new Map<string, number>();
  for (const entry of scored) {
    if (selected.length >= limit) break;
    const cat = entry.spot.category || 'other';
    const count = perCat.get(cat) ?? 0;
    if (count >= maxPerCategory) continue;
    selected.push(entry);
    perCat.set(cat, count + 1);
  }
  if (selected.length < limit) {
    const ids = new Set(selected.map((s) => s.spot.id));
    for (const entry of scored) {
      if (selected.length >= limit) break;
      if (ids.has(entry.spot.id)) continue;
      selected.push(entry);
    }
  }
  return selected;
}
