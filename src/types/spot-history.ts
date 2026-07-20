export type MemberSpotRating = {
  memberId: string;
  rating: 1 | 2 | 3 | 4 | 5;
};

/**
 * One visit record. Same spotId may appear many times (multiple visits).
 * spotDisplayName is display-only snapshot; all logic uses spotId.
 */
export type SpotHistory = {
  id: string;
  spotId: string;
  /** Display-only. Do not use for AI, search, filter, or penalties. */
  spotDisplayName?: string;
  visitedOn: string;
  participantIds: string[];
  memberRatings: MemberSpotRating[];
  note?: string;
  wantAgain?: boolean;
  updatedAt: string;
};

export function isValidRating(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

/** Family average from memberRatings (not stored). */
export function averageMemberRatings(
  ratings: MemberSpotRating[]
): number | null {
  if (ratings.length === 0) {
    return null;
  }
  const sum = ratings.reduce((acc, entry) => acc + entry.rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function latestVisitForSpot(
  histories: SpotHistory[],
  spotId: string
): SpotHistory | undefined {
  const matches = histories.filter((entry) => entry.spotId === spotId);
  if (matches.length === 0) {
    return undefined;
  }
  return matches.reduce((latest, entry) =>
    entry.visitedOn > latest.visitedOn ? entry : latest
  );
}

export function visitCountForSpot(
  histories: SpotHistory[],
  spotId: string
): number {
  return histories.filter((entry) => entry.spotId === spotId).length;
}
