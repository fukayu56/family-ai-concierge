import type { AiPlanDraft, AiRecommendationDraft } from './recommendation-ai-draft';
import {
  calculateLocalEnjoymentMinutesFromTimeline,
  calculateRoundTripMinutesFromTimeline,
  formatDurationMinutes,
} from './recommendation-business-validation';
import type { Plan, RecommendationResponse } from './recommendation-response';

function enrichPlanDraft(planDraft: AiPlanDraft): Plan {
  const roundTrip = calculateRoundTripMinutesFromTimeline(planDraft.timeline);
  if ('error' in roundTrip) {
    throw new Error(`${planDraft.id}: ${roundTrip.error}`);
  }
  if (roundTrip.minutes <= 0) {
    throw new Error(`${planDraft.id}: computed roundTripTime is 0 minutes`);
  }

  const localEnjoyment = calculateLocalEnjoymentMinutesFromTimeline(
    planDraft.timeline
  );
  if ('error' in localEnjoyment) {
    throw new Error(`${planDraft.id}: ${localEnjoyment.error}`);
  }
  if (localEnjoyment.minutes <= 0) {
    throw new Error(`${planDraft.id}: computed localEnjoymentTime is 0 minutes`);
  }

  return {
    id: planDraft.id,
    title: planDraft.title,
    reason: planDraft.reason,
    cost: planDraft.cost,
    spots: planDraft.spots,
    withinBudget: planDraft.withinBudget,
    timeline: planDraft.timeline,
    roundTripTime: formatDurationMinutes(roundTrip.minutes),
    localEnjoymentTime: formatDurationMinutes(localEnjoyment.minutes),
  };
}

/**
 * Build the final RecommendationResponse by computing duration fields
 * from each plan timeline on the server.
 */
export function enrichRecommendationWithCalculatedTimes(
  draft: AiRecommendationDraft
): RecommendationResponse {
  const plans: Plan[] = draft.plans.map((planDraft) => enrichPlanDraft(planDraft));

  return { plans };
}

/**
 * Enrich a single AI plan draft (relaxed scenarios).
 */
export function enrichSinglePlanDraft(planDraft: AiPlanDraft): Plan {
  return enrichPlanDraft(planDraft);
}
