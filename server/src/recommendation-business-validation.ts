import type { RecommendationResponse } from './recommendation-response';

export type OutingBusinessConditions = {
  budget: string;
  endTime: string;
};

/**
 * Extract a yen amount from strings like "12000円" or "12,000円".
 * Returns null when no numeric amount can be found.
 */
export function parseYenAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/円/g, '').trim();
  const match = cleaned.match(/\d+/);
  if (!match) {
    return null;
  }

  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Parse HH:mm into minutes from midnight. Rejects ranges and other formats.
 */
export function parseHhMm(raw: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Stage-1 business rules for recommendation plans:
 * 1. cost vs withinBudget consistency against budget
 * 2. last return time must not exceed endTime (HH:mm only)
 */
export function validateRecommendationBusinessRules(
  response: RecommendationResponse,
  conditions: OutingBusinessConditions
): void {
  const failures: string[] = [];
  const budget = parseYenAmount(conditions.budget);
  const endTimeMinutes = parseHhMm(conditions.endTime);

  if (budget == null) {
    failures.push('conditions: budget amount is not parseable');
  }

  if (endTimeMinutes == null) {
    failures.push('conditions: endTime must be HH:mm');
  }

  for (const plan of response.plans) {
    const cost = parseYenAmount(plan.cost);
    if (cost == null) {
      failures.push(`${plan.id}: cost amount is not parseable`);
    } else if (budget != null) {
      const expectedWithinBudget = cost <= budget;
      if (plan.withinBudget !== expectedWithinBudget) {
        failures.push(`${plan.id}: cost and withinBudget are inconsistent`);
      }
    }

    const returnItems = plan.timeline.filter((item) => item.type === 'return');
    if (returnItems.length < 1) {
      failures.push(`${plan.id}: timeline must include at least one return`);
      continue;
    }

    const lastReturn = returnItems[returnItems.length - 1];
    const returnMinutes = parseHhMm(lastReturn.time);
    if (returnMinutes == null) {
      failures.push(`${plan.id}: return time must be HH:mm`);
      continue;
    }

    if (endTimeMinutes != null && returnMinutes > endTimeMinutes) {
      failures.push(`${plan.id}: return time exceeds endTime`);
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}
