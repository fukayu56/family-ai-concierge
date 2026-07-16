import {
  TIMELINE_ITEM_TYPES,
  type TimelineItemType,
} from './recommendation-response';

export type AiTimelineItem = {
  time: string;
  title: string;
  description: string;
  type: TimelineItemType;
};

export type AiPlanDraft = {
  id: string;
  title: string;
  reason: string;
  cost: string;
  spots: string;
  withinBudget: boolean;
  timeline: AiTimelineItem[];
};

export type AiRecommendationDraft = {
  plans: AiPlanDraft[];
};

/** Single-plan AI draft for relaxed scenarios (e.g. budget_relaxed). */
export type AiRelaxedRecommendationDraft = {
  plans: [AiPlanDraft];
};

const planDraftSchemaProperties = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'reason',
    'cost',
    'spots',
    'withinBudget',
    'timeline',
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    reason: { type: 'string' },
    cost: { type: 'string' },
    spots: { type: 'string' },
    withinBudget: { type: 'boolean' },
    timeline: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['time', 'title', 'description', 'type'],
        properties: {
          time: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: ['departure', 'spot', 'meal', 'return'],
          },
        },
      },
    },
  },
} as const;

/**
 * JSON Schema for AI draft responses (no server-owned duration fields).
 * Used with OpenAI Structured Outputs.
 */
export const aiRecommendationDraftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['plans'],
  properties: {
    plans: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: planDraftSchemaProperties,
    },
  },
} as const;

/**
 * JSON Schema for relaxed single-plan AI draft responses.
 */
export const aiRelaxedRecommendationDraftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['plans'],
  properties: {
    plans: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: planDraftSchemaProperties,
    },
  },
} as const;

const PLAN_DRAFT_REQUIRED_KEYS = [
  'id',
  'title',
  'reason',
  'cost',
  'spots',
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
 * Runtime validation for AI draft responses before server-side enrichment.
 */
export function validateAiRecommendationDraft(
  data: unknown
): asserts data is AiRecommendationDraft {
  validateAiPlanDrafts(data, 3);
}

/**
 * Runtime validation for relaxed single-plan AI draft responses.
 */
export function validateAiRelaxedRecommendationDraft(
  data: unknown
): asserts data is AiRelaxedRecommendationDraft {
  validateAiPlanDrafts(data, 1);
}

function validateAiPlanDrafts(data: unknown, expectedPlanCount: number): void {
  if (!isPlainObject(data)) {
    throw new Error('AIの返却形式が不正です');
  }

  if (!Array.isArray(data.plans)) {
    throw new Error('AIの返却形式が不正です');
  }

  if (data.plans.length !== expectedPlanCount) {
    throw new Error('AIの返却形式が不正です');
  }

  for (const plan of data.plans) {
    if (!isPlainObject(plan)) {
      throw new Error('AIの返却形式が不正です');
    }

    for (const key of PLAN_DRAFT_REQUIRED_KEYS) {
      if (!(key in plan)) {
        throw new Error('AIの返却形式が不正です');
      }
    }

    if (
      typeof plan.id !== 'string' ||
      typeof plan.title !== 'string' ||
      typeof plan.reason !== 'string' ||
      typeof plan.cost !== 'string' ||
      typeof plan.spots !== 'string'
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
