import type { SpotListItem } from '@/types/spot-list';

/**
 * Extensible filter for the destination list.
 * Phase D implements prefecture + city only.
 * Optional fields are reserved for later phases (do not require UI yet).
 */
export type SpotListFilter = {
  prefecture: string;
  city?: string;
  // Future:
  // visitStatus?: 'all' | 'visited' | 'unvisited';
  // sortBy?: 'name' | 'rating' | 'lastVisited';
  // category?: string;
  // indoor?: boolean;
};

/**
 * Client-side filter after GET /api/spots.
 * Prefer server ?city= when available; this remains for local refinement.
 */
export function filterSpots(
  spots: SpotListItem[],
  filter: SpotListFilter
): SpotListItem[] {
  return spots.filter((spot) => {
    if (filter.city && filter.city.trim() !== '') {
      if (spot.city !== filter.city) {
        return false;
      }
    }
    return true;
  });
}

export function sortSpotsByName(spots: SpotListItem[]): SpotListItem[] {
  return [...spots].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}
