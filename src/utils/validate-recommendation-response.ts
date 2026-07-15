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

export type RecommendationResponse = {
  plans: Plan[];
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimelineItemType(value: unknown): value is TimelineItemType {
  return (
    typeof value === 'string' &&
    (TIMELINE_ITEM_TYPES as readonly string[]).includes(value)
  );
}

function hasRequiredTimelineTypes(
  timeline: Array<{ type: TimelineItemType }>
): boolean {
  const types = new Set(timeline.map((item) => item.type));
  return REQUIRED_TIMELINE_TYPES.every((type) => types.has(type));
}

/**
 * Client-side guard: invalid AI responses must not reach the UI (charter §7).
 */
export function validateRecommendationResponse(
  data: unknown
): asserts data is RecommendationResponse {
  if (!isPlainObject(data)) {
    throw new Error('AIの返却形式が不正です');
  }

  if (!Array.isArray(data.plans)) {
    throw new Error('AIの返却形式が不正です');
  }

  if (data.plans.length !== 3) {
    throw new Error('AIの返却形式が不正です');
  }

  for (const plan of data.plans) {
    if (!isPlainObject(plan)) {
      throw new Error('AIの返却形式が不正です');
    }

    for (const key of PLAN_REQUIRED_KEYS) {
      if (!(key in plan)) {
        throw new Error('AIの返却形式が不正です');
      }
    }

    if (
      typeof plan.id !== 'string' ||
      typeof plan.title !== 'string' ||
      typeof plan.reason !== 'string' ||
      typeof plan.cost !== 'string' ||
      typeof plan.spots !== 'string' ||
      typeof plan.localEnjoymentTime !== 'string' ||
      typeof plan.roundTripTime !== 'string'
    ) {
      throw new Error('AIの返却形式が不正です');
    }

    if (typeof plan.withinBudget !== 'boolean') {
      throw new Error('AIの返却形式が不正です');
    }

    if (!Array.isArray(plan.timeline) || plan.timeline.length < 1) {
      throw new Error('AIの返却形式が不正です');
    }

    for (const item of plan.timeline) {
      if (!isPlainObject(item)) {
        throw new Error('AIの返却形式が不正です');
      }

      for (const key of TIMELINE_REQUIRED_KEYS) {
        if (!(key in item)) {
          throw new Error('AIの返却形式が不正です');
        }
      }

      if (
        typeof item.time !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.description !== 'string' ||
        !isTimelineItemType(item.type)
      ) {
        throw new Error('AIの返却形式が不正です');
      }
    }

    const typedTimeline = plan.timeline as Array<{ type: TimelineItemType }>;
    if (!hasRequiredTimelineTypes(typedTimeline)) {
      throw new Error('AIの返却形式が不正です');
    }
  }
}
