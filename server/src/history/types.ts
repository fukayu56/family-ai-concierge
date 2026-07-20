export type HistoryPromptSummary = {
  recentVisits: Array<{
    spotId: string;
    spotName: string;
    visitedOn: string;
    daysSinceVisit: number;
  }>;
  highlyRatedPreferences: Array<{
    memberId: string;
    memberName: string;
    categories: string[];
    representativeSpots: string[];
  }>;
  lowRatedPreferences: Array<{
    memberId: string;
    memberName: string;
    categories: string[];
    representativeSpots: string[];
  }>;
};

export type HistorySummaryVisitInput = {
  spotId: string;
  visitedOn: string;
  memberRatings?: Array<{ memberId: string; rating: number }>;
};

export type HistorySummarySpotLookup = {
  id: string;
  name: string;
  category: string;
};

export type HistorySummaryMember = {
  id: string;
  name: string;
};

export const HISTORY_SUMMARY_LIMITS = {
  recentVisits: 10,
  categoriesPerMember: 3,
  spotsPerMember: 3,
  highRatingMin: 4,
  lowRatingMax: 2,
} as const;
