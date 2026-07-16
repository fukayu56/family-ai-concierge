/**
 * Common spot format used before AI prompt enrichment.
 * All data sources (sample, OpenData, OSM, Places) must map into this shape.
 *
 * Future optional fields (not used yet):
 * - openingHours
 * - parking
 * - childFriendly
 * - indoor
 * - outdoor
 * - stroller
 * - rating
 * - reviewCount
 * - estimatedCost
 */
export type SpotCandidate = {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude?: number;
  longitude?: number;
  description: string;
  tags: string[];
  source: string;
  sourceUrl: string;
  lastUpdated: string;
};
