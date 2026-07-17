/**
 * Common spot format used before AI prompt enrichment.
 * All data sources (sample, OpenData, OSM, Places) must map into this shape.
 *
 * Phase A optional filter attributes (all optional; missing = unknown):
 * - indoor, parking, costLevel, recommendedAge, verified, confidence
 *
 * Future optional fields (not used yet):
 * - openingHours
 * - childFriendly
 * - outdoor
 * - stroller
 * - rating
 * - reviewCount
 * - estimatedCost
 */
export type SpotCostLevel = 'free' | 'low' | 'medium' | 'high';

export type SpotConfidence = 'verified' | 'inferred' | 'unknown';

export type SpotCandidate = {
  id: string;
  name: string;
  category: string;
  /** Municipality name, e.g. 刈谷市. Optional for legacy sample rows. */
  city?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  description: string;
  tags: string[];
  source: string;
  sourceUrl: string;
  lastUpdated: string;

  /** true = indoor facility, false = outdoor-focused, undefined = unknown */
  indoor?: boolean;
  /** true/false only when confirmed; undefined = unknown (do not invent) */
  parking?: boolean;
  /** Coarse cost band; undefined when unknown */
  costLevel?: SpotCostLevel;
  /** Age labels such as "3-6", "elementary"; undefined when unknown */
  recommendedAge?: string[];
  /** true when attributes were human/source verified */
  verified?: boolean;
  /** How much to trust derived Phase A attributes */
  confidence?: SpotConfidence;
};
