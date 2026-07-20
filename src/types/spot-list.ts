/**
 * Spot fields needed for the destination list UI.
 * Subset of server SpotCandidate — does not include family history.
 */
export type SpotListItem = {
  id: string;
  name: string;
  category: string;
  city?: string;
  address: string;
  description: string;
  tags: string[];
  indoor?: boolean;
  parking?: boolean;
  costLevel?: 'free' | 'low' | 'medium' | 'high';
  recommendedAge?: string[];
};

export type SpotsListResponse = {
  spots: SpotListItem[];
  meta: {
    prefecture: string;
    cities: string[];
    total: number;
  };
};
