import type { SpotCandidate } from '../models/SpotCandidate';
import { parseYenAmount } from '../recommendation-business-validation';

/** Spot with deterministic retrieval score (does not mutate SpotCandidate). */
export type ScoredSpotCandidate = {
  spot: SpotCandidate;
  score: number;
  reasons: string[];
};

/**
 * Inputs available to ScenarioFilter v1.
 * Fields that exist on the request/envelope today; unused fields stay as TODOs.
 */
export type ScenarioFilterContext = {
  /** Optional enrichment weather string (e.g. body.weather). */
  weather?: string;
  /** Envelope / conditions transport. */
  transport: string;
  /** Envelope budgetMax in yen (preferred over raw string). */
  budgetMax: number;
  /**
   * TODO(v2): use startTime/endTime with estimatedStayMinutes.
   * Accepted for API symmetry; unused in v1 scoring.
   */
  startTime?: string;
  endTime?: string;
  /**
   * TODO(v2): use structured age attributes (not recommendedAge string[]).
   * Accepted for API symmetry; unused in v1 scoring.
   */
  participantAges?: Array<number | null>;
};

/** Evidence strength for Phase A attributes (confidence / verified). */
export type AttributeEvidence = 'verified' | 'inferred' | 'unknown';

/** Named score deltas — keep small and readable. */
export const SCENARIO_SCORE = {
  STRONG_BONUS: 3,
  WEAK_BONUS: 1,
  WEAK_PENALTY: -1,
} as const;

/**
 * Budgets at or below this yen amount are treated as "low budget"
 * for coarse costLevel scoring only (not exact yen comparison).
 */
export const LOW_BUDGET_MAX_YEN = 10_000;

/** Soft cap when passing many open-data spots into the prompt. */
export const PROMPT_CANDIDATE_LIMIT = 20;

/**
 * Resolve attribute evidence without scattering priority rules.
 * Priority: confidence=verified → verified=true → confidence=inferred → unknown.
 */
export function resolveAttributeEvidence(
  spot: SpotCandidate
): AttributeEvidence {
  if (spot.confidence === 'verified') {
    return 'verified';
  }
  if (spot.verified === true) {
    return 'verified';
  }
  if (spot.confidence === 'inferred') {
    return 'inferred';
  }
  return 'unknown';
}

/**
 * Detect rainy outing conditions from enrichment text.
 * Returns undefined when weather is missing or ambiguous (no rain scoring).
 */
export function detectRainyWeather(
  weather: string | undefined
): boolean | undefined {
  if (weather == null || weather.trim() === '') {
    return undefined;
  }

  const text = weather.trim();
  if (
    /雨|雷雨|霧雨|drizzle|shower|\brain\b|thunderstorm/i.test(text)
  ) {
    return true;
  }
  if (/晴|快晴|sunny|clear|くもり|曇|cloud|曇り/i.test(text)) {
    return false;
  }
  return undefined;
}

export function isCarTransport(transport: string): boolean {
  return /車|自動車|マイカー|ドライブ|\bcar\b|\bdrive\b/i.test(transport);
}

export function isLowBudget(budgetMax: number): boolean {
  return Number.isFinite(budgetMax) && budgetMax <= LOW_BUDGET_MAX_YEN;
}

type ScoreAccum = {
  score: number;
  reasons: string[];
};

function applyIndoorWeatherRules(
  spot: SpotCandidate,
  rainy: boolean | undefined,
  evidence: AttributeEvidence,
  accum: ScoreAccum
): void {
  if (rainy === true) {
    if (spot.indoor === true) {
      if (evidence === 'verified') {
        accum.score += SCENARIO_SCORE.STRONG_BONUS;
        accum.reasons.push('雨天のため屋内施設を優先（verified）');
      } else if (evidence === 'inferred') {
        accum.score += SCENARIO_SCORE.WEAK_BONUS;
        accum.reasons.push('雨天のため屋内施設を弱く優先（inferred・名称等からの推測）');
      }
      // unknown evidence with indoor=true: treat as weak inferred-equivalent? 
      // Spec: only verified strong / inferred weak. If indoor set but evidence unknown,
      // still soft-bonus as weak (data exists but confidence unset).
      else {
        accum.score += SCENARIO_SCORE.WEAK_BONUS;
        accum.reasons.push('雨天のため屋内施設を弱く優先（confidence未設定）');
      }
      return;
    }
    if (spot.indoor === false) {
      accum.score += SCENARIO_SCORE.WEAK_PENALTY;
      accum.reasons.push('雨天のため屋外寄り施設を弱く減点');
      return;
    }
    // indoor === undefined → no change
    return;
  }

  if (rainy === false) {
    // Do not penalize indoor on sunny days. Tiny outdoor preference only.
    if (spot.indoor === false) {
      accum.score += SCENARIO_SCORE.WEAK_BONUS;
      accum.reasons.push('晴天のため屋外寄り施設を小さく加点');
    }
  }
  // rainy === undefined → no weather-based scoring
}

function applyParkingRules(
  spot: SpotCandidate,
  carTransport: boolean,
  accum: ScoreAccum
): void {
  if (!carTransport) {
    return;
  }
  if (spot.parking === true) {
    accum.score += SCENARIO_SCORE.WEAK_BONUS;
    accum.reasons.push('車移動で駐車場あり');
    return;
  }
  if (spot.parking === false) {
    accum.score += SCENARIO_SCORE.WEAK_PENALTY;
    accum.reasons.push('車移動だが駐車場なし（確認済み）');
  }
  // undefined → no change
}

function applyCostLevelRules(
  spot: SpotCandidate,
  lowBudget: boolean,
  accum: ScoreAccum
): void {
  if (spot.costLevel === undefined) {
    return;
  }
  if (spot.costLevel === 'free') {
    accum.score += SCENARIO_SCORE.WEAK_BONUS;
    accum.reasons.push(
      lowBudget ? '低予算条件で無料施設' : '無料施設'
    );
    return;
  }
  if (spot.costLevel === 'low') {
    accum.score += SCENARIO_SCORE.WEAK_BONUS;
    accum.reasons.push('費用帯が低め');
    return;
  }
  if (spot.costLevel === 'medium') {
    return;
  }
  if (spot.costLevel === 'high' && lowBudget) {
    accum.score += SCENARIO_SCORE.WEAK_PENALTY;
    accum.reasons.push('低予算条件で高費用帯を弱く減点');
  }
}

/**
 * Score a single spot. Does not mutate `spot`.
 *
 * TODO(v2): recommendedAge string[] is too ambiguous — skip until structured ages exist.
 * TODO(v2): estimatedStayMinutes vs available time window.
 * TODO(v2): AbsoluteFilter for hard exclusions (age bans, closed today).
 */
export function scoreSpotCandidate(
  spot: SpotCandidate,
  context: ScenarioFilterContext
): ScoredSpotCandidate {
  const accum: ScoreAccum = { score: 0, reasons: [] };
  const evidence = resolveAttributeEvidence(spot);
  const rainy = detectRainyWeather(context.weather);
  const carTransport = isCarTransport(context.transport);
  const lowBudget = isLowBudget(context.budgetMax);

  applyIndoorWeatherRules(spot, rainy, evidence, accum);
  applyParkingRules(spot, carTransport, accum);
  applyCostLevelRules(spot, lowBudget, accum);

  // recommendedAge intentionally unused in v1 (see TODO above).

  return {
    spot,
    score: accum.score,
    reasons: accum.reasons,
  };
}

/**
 * Rank spots for a scenario without deleting candidates.
 * Stable sort: score desc, then original index asc.
 */
export function applyScenarioFilter(
  spots: SpotCandidate[],
  context: ScenarioFilterContext
): ScoredSpotCandidate[] {
  const scored = spots.map((spot, originalIndex) => ({
    ...scoreSpotCandidate(spot, context),
    originalIndex,
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.originalIndex - b.originalIndex;
  });

  return scored.map(({ spot, score, reasons }) => ({ spot, score, reasons }));
}

/**
 * Limit prompt candidates without aggressive cuts.
 * Preserves ScenarioFilter order.
 */
export function takePromptCandidates(
  scored: ScoredSpotCandidate[],
  limit: number = PROMPT_CANDIDATE_LIMIT
): ScoredSpotCandidate[] {
  if (scored.length <= limit) {
    return scored;
  }
  return scored.slice(0, limit);
}

/** Build filter context from envelope + optional weather enrichment. */
export function buildScenarioFilterContextFromEnvelope(
  envelope: {
    budgetMax: number;
    transport: string;
    startTime: string;
    endTime: string;
  },
  options: {
    weather?: string;
    participantAges?: Array<number | null>;
  } = {}
): ScenarioFilterContext {
  return {
    weather: options.weather,
    transport: envelope.transport,
    budgetMax: envelope.budgetMax,
    startTime: envelope.startTime,
    endTime: envelope.endTime,
    participantAges: options.participantAges,
  };
}

/** Parse raw budget string when envelope is not yet built (tests / scripts). */
export function parseBudgetMaxOrZero(budget: string): number {
  return parseYenAmount(budget) ?? 0;
}
