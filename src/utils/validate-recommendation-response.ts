export const TIMELINE_ITEM_TYPES = [
  'departure',
  'spot',
  'meal',
  'return',
] as const;

export type TimelineItemType = (typeof TIMELINE_ITEM_TYPES)[number];

export type TimelineItem = {
  time: string;
  title: string;
  description: string;
  type: TimelineItemType;
};

export type Plan = {
  id: string;
  title: string;
  reason: string;
  cost: string;
  spots: string;
  localEnjoymentTime: string;
  roundTripTime: string;
  withinBudget: boolean;
  timeline: TimelineItem[];
};

/** Matches server `RetrievalScenarioId` relaxed variants. */
export type RelaxedScenarioId = 'budget_relaxed' | 'time_relaxed';

/**
 * Matches server `RelaxationHint` (`server/src/constraints/types.ts`).
 * scenarioId on the server type allows 'strict', but relaxed entries use relaxed ids.
 */
export type RelaxationHint = {
  scenarioId: string;
  label: string;
  changedFields: string[];
  before: Record<string, string>;
  after: Record<string, string>;
};

/** Matches server `RelaxedPlanEntry`. */
export type RelaxedPlanEntry = {
  scenarioId: RelaxedScenarioId;
  relaxationHint: RelaxationHint;
  plan: Plan;
};

export type RecommendationResponse = {
  plans: Plan[];
  relaxedPlans?: RelaxedPlanEntry[];
};

const PLAN_REQUIRED_KEYS = [
  'id',
  'title',
  'reason',
  'cost',
  'spots',
  'localEnjoymentTime',
  'roundTripTime',
  'withinBudget',
  'timeline',
] as const;

const TIMELINE_REQUIRED_KEYS = [
  'time',
  'title',
  'description',
  'type',
] as const;

const REQUIRED_TIMELINE_TYPES: TimelineItemType[] = [
  'departure',
  'spot',
  'meal',
  'return',
];

const RELAXED_SCENARIO_IDS: readonly RelaxedScenarioId[] = [
  'budget_relaxed',
  'time_relaxed',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimelineItemType(value: unknown): value is TimelineItemType {
  return (
    typeof value === 'string' &&
    (TIMELINE_ITEM_TYPES as readonly string[]).includes(value)
  );
}

function isRelaxedScenarioId(value: unknown): value is RelaxedScenarioId {
  return (
    typeof value === 'string' &&
    (RELAXED_SCENARIO_IDS as readonly string[]).includes(value)
  );
}

function hasRequiredTimelineTypes(
  timeline: Array<{ type: TimelineItemType }>
): boolean {
  const types = new Set(timeline.map((item) => item.type));
  return REQUIRED_TIMELINE_TYPES.every((type) => types.has(type));
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
}

/**
 * Validates a single Plan shape (same rules as strict plans).
 * Returns false instead of throwing so callers can skip bad relaxed entries.
 */
function tryParsePlan(plan: unknown): Plan | null {
  if (!isPlainObject(plan)) {
    return null;
  }

  for (const key of PLAN_REQUIRED_KEYS) {
    if (!(key in plan)) {
      return null;
    }
  }

  if (
    typeof plan.id !== 'string' ||
    typeof plan.title !== 'string' ||
    typeof plan.reason !== 'string' ||
    typeof plan.cost !== 'string' ||
    typeof plan.spots !== 'string' ||
    typeof plan.localEnjoymentTime !== 'string' ||
    typeof plan.roundTripTime !== 'string' ||
    typeof plan.withinBudget !== 'boolean'
  ) {
    return null;
  }

  if (!Array.isArray(plan.timeline) || plan.timeline.length < 1) {
    return null;
  }

  const timeline: TimelineItem[] = [];
  for (const item of plan.timeline) {
    if (!isPlainObject(item)) {
      return null;
    }

    for (const key of TIMELINE_REQUIRED_KEYS) {
      if (!(key in item)) {
        return null;
      }
    }

    if (
      typeof item.time !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.description !== 'string' ||
      !isTimelineItemType(item.type)
    ) {
      return null;
    }

    timeline.push({
      time: item.time,
      title: item.title,
      description: item.description,
      type: item.type,
    });
  }

  if (!hasRequiredTimelineTypes(timeline)) {
    return null;
  }

  return {
    id: plan.id,
    title: plan.title,
    reason: plan.reason,
    cost: plan.cost,
    spots: plan.spots,
    localEnjoymentTime: plan.localEnjoymentTime,
    roundTripTime: plan.roundTripTime,
    withinBudget: plan.withinBudget,
    timeline,
  };
}

function tryParseRelaxationHint(value: unknown): RelaxationHint | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (
    typeof value.scenarioId !== 'string' ||
    typeof value.label !== 'string' ||
    !Array.isArray(value.changedFields) ||
    !value.changedFields.every((field) => typeof field === 'string') ||
    !isStringRecord(value.before) ||
    !isStringRecord(value.after)
  ) {
    return null;
  }

  return {
    scenarioId: value.scenarioId,
    label: value.label,
    changedFields: value.changedFields,
    before: value.before,
    after: value.after,
  };
}

function tryParseRelaxedPlanEntry(value: unknown): RelaxedPlanEntry | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (!isRelaxedScenarioId(value.scenarioId)) {
    return null;
  }

  const relaxationHint = tryParseRelaxationHint(value.relaxationHint);
  if (relaxationHint == null) {
    return null;
  }

  const plan = tryParsePlan(value.plan);
  if (plan == null) {
    return null;
  }

  return {
    scenarioId: value.scenarioId,
    relaxationHint,
    plan,
  };
}

/**
 * Parse API response: strict `plans` must be valid (throws).
 * Invalid `relaxedPlans` entries are skipped so strict results still display.
 */
export function parseRecommendationResponse(
  data: unknown
): RecommendationResponse {
  if (!isPlainObject(data)) {
    throw new Error('AIの返却形式が不正です');
  }

  if (!Array.isArray(data.plans)) {
    throw new Error('AIの返却形式が不正です');
  }

  if (data.plans.length !== 3) {
    throw new Error('AIの返却形式が不正です');
  }

  const plans: Plan[] = [];
  for (const plan of data.plans) {
    const parsed = tryParsePlan(plan);
    if (parsed == null) {
      throw new Error('AIの返却形式が不正です');
    }
    plans.push(parsed);
  }

  let relaxedPlans: RelaxedPlanEntry[] | undefined;
  if (data.relaxedPlans !== undefined) {
    if (!Array.isArray(data.relaxedPlans)) {
      // Malformed optional field: keep strict plans, ignore relaxed.
      relaxedPlans = [];
    } else {
      relaxedPlans = [];
      for (const entry of data.relaxedPlans) {
        const parsed = tryParseRelaxedPlanEntry(entry);
        if (parsed != null) {
          relaxedPlans.push(parsed);
        }
      }
    }
  }

  return {
    plans,
    ...(relaxedPlans !== undefined ? { relaxedPlans } : {}),
  };
}

/**
 * Client-side guard: invalid AI responses must not reach the UI (charter §7).
 * @deprecated Prefer parseRecommendationResponse for relaxedPlans-safe parsing.
 */
export function validateRecommendationResponse(
  data: unknown
): asserts data is RecommendationResponse {
  parseRecommendationResponse(data);
}
