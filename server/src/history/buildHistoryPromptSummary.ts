import { buildDaysSinceBySpotId } from '../filters/applyRecentVisitPenalty';
import {
  HISTORY_SUMMARY_LIMITS,
  type HistoryPromptSummary,
  type HistorySummaryMember,
  type HistorySummarySpotLookup,
  type HistorySummaryVisitInput,
} from './types';

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

type MemberAgg = {
  memberId: string;
  memberName: string;
  highCategories: string[];
  highSpots: string[];
  lowCategories: string[];
  lowSpots: string[];
};

/**
 * Build a compact history summary for the OpenAI prompt.
 * Uses spotId as the join key; spot names are for human-readable prompt text only.
 */
export function buildHistoryPromptSummary(
  visits: HistorySummaryVisitInput[],
  spots: HistorySummarySpotLookup[],
  members: HistorySummaryMember[],
  today: Date = new Date()
): HistoryPromptSummary {
  const spotById = new Map(spots.map((spot) => [spot.id, spot]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const daysSinceBySpotId = buildDaysSinceBySpotId(visits, today);

  const recentCandidates = visits
    .map((visit) => {
      const days = daysSinceBySpotId.get(visit.spotId);
      if (days == null) {
        return null;
      }
      const spot = spotById.get(visit.spotId);
      return {
        spotId: visit.spotId,
        spotName: spot?.name ?? visit.spotId,
        visitedOn: visit.visitedOn,
        daysSinceVisit: days,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => {
      if (a.daysSinceVisit !== b.daysSinceVisit) {
        return a.daysSinceVisit - b.daysSinceVisit;
      }
      return b.visitedOn.localeCompare(a.visitedOn);
    });

  // Deduplicate by spotId keeping most recent
  const recentVisits: HistoryPromptSummary['recentVisits'] = [];
  const seenRecent = new Set<string>();
  for (const entry of recentCandidates) {
    if (seenRecent.has(entry.spotId)) {
      continue;
    }
    seenRecent.add(entry.spotId);
    recentVisits.push(entry);
    if (recentVisits.length >= HISTORY_SUMMARY_LIMITS.recentVisits) {
      break;
    }
  }

  const aggByMember = new Map<string, MemberAgg>();

  function ensureMember(memberId: string): MemberAgg {
    const existing = aggByMember.get(memberId);
    if (existing) {
      return existing;
    }
    const created: MemberAgg = {
      memberId,
      memberName: memberById.get(memberId)?.name ?? memberId,
      highCategories: [],
      highSpots: [],
      lowCategories: [],
      lowSpots: [],
    };
    aggByMember.set(memberId, created);
    return created;
  }

  for (const visit of visits) {
    const spot = spotById.get(visit.spotId);
    const spotName = spot?.name ?? visit.spotId;
    const category = spot?.category ?? 'other';
    for (const rating of visit.memberRatings ?? []) {
      const agg = ensureMember(rating.memberId);
      if (rating.rating >= HISTORY_SUMMARY_LIMITS.highRatingMin) {
        agg.highSpots.push(spotName);
        agg.highCategories.push(category);
      } else if (rating.rating <= HISTORY_SUMMARY_LIMITS.lowRatingMax) {
        agg.lowSpots.push(spotName);
        agg.lowCategories.push(category);
      }
    }
  }

  const highlyRatedPreferences: HistoryPromptSummary['highlyRatedPreferences'] =
    [];
  const lowRatedPreferences: HistoryPromptSummary['lowRatedPreferences'] = [];

  for (const agg of aggByMember.values()) {
    const highSpots = uniquePreserveOrder(agg.highSpots).slice(
      0,
      HISTORY_SUMMARY_LIMITS.spotsPerMember
    );
    const highCategories = uniquePreserveOrder(agg.highCategories).slice(
      0,
      HISTORY_SUMMARY_LIMITS.categoriesPerMember
    );
    if (highSpots.length > 0 || highCategories.length > 0) {
      highlyRatedPreferences.push({
        memberId: agg.memberId,
        memberName: agg.memberName,
        categories: highCategories,
        representativeSpots: highSpots,
      });
    }

    const lowSpots = uniquePreserveOrder(agg.lowSpots).slice(
      0,
      HISTORY_SUMMARY_LIMITS.spotsPerMember
    );
    const lowCategories = uniquePreserveOrder(agg.lowCategories).slice(
      0,
      HISTORY_SUMMARY_LIMITS.categoriesPerMember
    );
    if (lowSpots.length > 0 || lowCategories.length > 0) {
      lowRatedPreferences.push({
        memberId: agg.memberId,
        memberName: agg.memberName,
        categories: lowCategories,
        representativeSpots: lowSpots,
      });
    }
  }

  return {
    recentVisits,
    highlyRatedPreferences,
    lowRatedPreferences,
  };
}

export function formatHistoryPromptSummarySection(
  summary: HistoryPromptSummary
): string[] {
  const hasContent =
    summary.recentVisits.length > 0 ||
    summary.highlyRatedPreferences.length > 0 ||
    summary.lowRatedPreferences.length > 0;
  if (!hasContent) {
    return [];
  }

  const lines: string[] = [
    '## 家族の過去のおでかけ履歴（要約）',
    '- 以下は参考情報。事実として断定しすぎないこと',
    '- 最近訪問した場所は近い日程での再提案を控えめにする（完全除外はしない）',
    '- 高評価の傾向を優先し、低評価の傾向は避ける',
  ];

  if (summary.recentVisits.length > 0) {
    lines.push('### 最近の訪問');
    for (const visit of summary.recentVisits) {
      lines.push(
        `- ${visit.spotName}（spotId: ${visit.spotId}）: ${visit.visitedOn} / ${visit.daysSinceVisit}日前`
      );
    }
  }

  if (summary.highlyRatedPreferences.length > 0) {
    lines.push('### 高評価の傾向');
    for (const entry of summary.highlyRatedPreferences) {
      lines.push(
        `- ${entry.memberName}: カテゴリ[${entry.categories.join('、') || 'なし'}] / 代表[${entry.representativeSpots.join('、') || 'なし'}]`
      );
    }
  }

  if (summary.lowRatedPreferences.length > 0) {
    lines.push('### 低評価の傾向');
    for (const entry of summary.lowRatedPreferences) {
      lines.push(
        `- ${entry.memberName}: カテゴリ[${entry.categories.join('、') || 'なし'}] / 代表[${entry.representativeSpots.join('、') || 'なし'}]`
      );
    }
  }

  return lines;
}
