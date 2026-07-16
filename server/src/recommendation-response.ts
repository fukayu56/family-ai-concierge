/** Allowed timeline step kinds for an outing plan. */
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

import type { RelaxationHint, RetrievalScenarioId } from './constraints/types';

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

export type RelaxedPlanEntry = {
  scenarioId: Exclude<RetrievalScenarioId, 'strict'>;
  relaxationHint: RelaxationHint;
  plan: Plan;
};

export type RecommendationResponse = {
  plans: Plan[];
  relaxedPlans?: RelaxedPlanEntry[];
};

/**
 * JSON Schema for AI recommendation responses.
 * Used with OpenAI Structured Outputs (`response_format.json_schema`, strict: true).
 *
 * Structured Outputs constraints (verified):
 * - every object has additionalProperties: false
 * - required fields are explicit
 * - plans minItems/maxItems = 3
 * - timeline minItems = 1
 * - timeline.type is an enum
 * - no optional properties
 */
export const recommendationResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['plans'],
  properties: {
    plans: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'title',
          'reason',
          'cost',
          'spots',
          'localEnjoymentTime',
          'roundTripTime',
          'withinBudget',
          'timeline',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          reason: { type: 'string' },
          cost: { type: 'string' },
          spots: { type: 'string' },
          localEnjoymentTime: { type: 'string' },
          roundTripTime: { type: 'string' },
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
      },
    },
  },
} as const;

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

/** Timeline must include movement, stay, lunch, and return (charter §5). */
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
 * Lightweight runtime check for RecommendationResponse.
 * Validates strict `plans` (3 items). Optional `relaxedPlans` are not checked here
 * so existing clients that only read `plans` remain compatible.
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
    validatePlanShape(plan);
  }
}

/**
 * Runtime validation for a single enriched plan (relaxed scenarios).
 */
export function validatePlan(data: unknown): asserts data is Plan {
  if (!isPlainObject(data)) {
    throw new Error('AIの返却形式が不正です');
  }

  validatePlanShape(data);
}

function validatePlanShape(plan: unknown): void {
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
