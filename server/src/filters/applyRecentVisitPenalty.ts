import type { SpotCandidate } from '../models/SpotCandidate';

import {
  PROMPT_CANDIDATE_LIMIT,
  SCENARIO_SCORE,
  type ScoredSpotCandidate,
} from './ScenarioFilter';

/** Soft penalty magnitudes aligned with SCENARIO_SCORE scale. */
export const RECENT_VISIT_STRONG_PENALTY = -SCENARIO_SCORE.STRONG_BONUS; // -3
export const RECENT_VISIT_WEAK_PENALTY = SCENARIO_SCORE.WEAK_PENALTY; // -1

export const RECENT_VISIT_STRONG_DAYS = 14;
export const RECENT_VISIT_WEAK_DAYS = 60;

export type RecentVisitPenaltyInput = {
  /** spotId → days since most recent visit */
  daysSinceBySpotId: Map<string, number>;
  /** spotIds marked wantAgain — strong penalty softened to weak */
  wantAgainSpotIds?: Set<string>;
  /** When true, halve penalties (candidate scarcity) */
  softenForScarceCandidates?: boolean;
};

function daysToPenalty(
  daysSince: number,
  wantAgain: boolean
): { delta: number; reason: string } | null {
  if (!Number.isFinite(daysSince) || daysSince < 0) {
    return null;
  }
  if (daysSince <= RECENT_VISIT_STRONG_DAYS) {
    const delta = wantAgain
      ? RECENT_VISIT_WEAK_PENALTY
      : RECENT_VISIT_STRONG_PENALTY;
    return {
      delta,
      reason: wantAgain
        ? '14日以内に訪問済み（また行きたいのため減点を緩和）'
        : '14日以内に訪問済みのため優先度を下げる',
    };
  }
  if (daysSince <= RECENT_VISIT_WEAK_DAYS) {
    return {
      delta: RECENT_VISIT_WEAK_PENALTY,
      reason: '60日以内に訪問済みのためやや優先度を下げる',
    };
  }
  return null;
}

function softenDelta(delta: number): number {
  if (delta >= 0) {
    return delta;
  }
  // Halve magnitude toward zero: -3 → -2, -1 → 0
  return Math.ceil(delta / 2);
}

/**
 * Apply soft recent-visit penalties. Never removes candidates.
 * Uses spotId only (never display names).
 */
export function applyRecentVisitPenalty(
  scored: ScoredSpotCandidate[],
  input: RecentVisitPenaltyInput
): ScoredSpotCandidate[] {
  const { daysSinceBySpotId, wantAgainSpotIds, softenForScarceCandidates } =
    input;

  return scored.map((entry) => {
    const days = daysSinceBySpotId.get(entry.spot.id);
    if (days == null) {
      return entry;
    }
    const wantAgain = wantAgainSpotIds?.has(entry.spot.id) === true;
    const penalty = daysToPenalty(days, wantAgain);
    if (penalty == null) {
      return entry;
    }
    const delta = softenForScarceCandidates
      ? softenDelta(penalty.delta)
      : penalty.delta;
    if (delta === 0) {
      return entry;
    }
    return {
      spot: entry.spot,
      score: entry.score + delta,
      reasons: [...entry.reasons, penalty.reason],
    };
  });
}

/**
 * If after penalties fewer than limit spots remain above a very low score floor,
 * re-run without scarcity soften is handled by caller. This helper decides soften flag.
 */
export function shouldSoftenRecentVisitPenalty(
  candidateCount: number,
  limit: number = PROMPT_CANDIDATE_LIMIT
): boolean {
  return candidateCount < limit;
}

/** Build days-since map from visit records (spotId + visitedOn YYYY-MM-DD). */
export function buildDaysSinceBySpotId(
  visits: Array<{ spotId: string; visitedOn: string }>,
  today: Date = new Date()
): Map<string, number> {
  const map = new Map<string, number>();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  for (const visit of visits) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(visit.visitedOn.trim());
    if (!match) {
      continue;
    }
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const visitUtc = Date.UTC(y, m - 1, d);
    const days = Math.floor((todayUtc - visitUtc) / (24 * 60 * 60 * 1000));
    if (!Number.isFinite(days) || days < 0) {
      continue;
    }
    const prev = map.get(visit.spotId);
    if (prev == null || days < prev) {
      map.set(visit.spotId, days);
    }
  }
  return map;
}

export function collectWantAgainSpotIds(
  visits: Array<{ spotId: string; wantAgain?: boolean }>
): Set<string> {
  const set = new Set<string>();
  for (const visit of visits) {
    if (visit.wantAgain === true) {
      set.add(visit.spotId);
    }
  }
  return set;
}

/** Re-sort after penalty (stable by original order via spot id fallback). */
export function resortScoredSpots(
  scored: ScoredSpotCandidate[],
  originalOrder: SpotCandidate[]
): ScoredSpotCandidate[] {
  const indexById = new Map(
    originalOrder.map((spot, index) => [spot.id, index])
  );
  return [...scored].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (indexById.get(a.spot.id) ?? 0) - (indexById.get(b.spot.id) ?? 0);
  });
}
