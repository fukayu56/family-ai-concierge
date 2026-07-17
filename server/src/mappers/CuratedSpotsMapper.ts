import type { SpotCandidate } from '../models/SpotCandidate';
import { applySafeIndoorInference } from './categoryNormalize';

/**
 * TECH_DEBT (temporary shared curated mapper):
 * - Why: Anjo/Okazaki/Toyota culture and Nagoya indoor facilities lack
 *   machine-readable family-spot lists we could download today.
 * - City-specific logic: none beyond reading per-city JSON files.
 * - Split when: each city gets an official CSV/API feed, or curated
 *   update automation starts (then keep one CuratedSpotsMapper or
 *   replace with city mappers that still accept curated overlays).
 * - Refactor order: (1) SourceMetadata, (2) per-city curated folders,
 *   (3) remove this if open data covers the same facilities.
 */
export type CuratedSpotRecord = {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  tags?: string[];
  source: string;
  sourceUrl: string;
  lastUpdated: string;
  indoor?: boolean;
  parking?: boolean;
  costLevel?: SpotCandidate['costLevel'];
  verified?: boolean;
  confidence?: SpotCandidate['confidence'];
};

export function parseCuratedSpotsJson(raw: string): SpotCandidate[] {
  const parsed = JSON.parse(raw) as CuratedSpotRecord[];
  if (!Array.isArray(parsed)) {
    throw new Error('curated spots JSON must be an array');
  }

  const spots: SpotCandidate[] = [];
  for (const row of parsed) {
    if (!row?.name?.trim() || !row?.id?.trim()) {
      continue;
    }
    const spot: SpotCandidate = {
      id: row.id.trim(),
      name: row.name.trim(),
      category: row.category?.trim() || 'other',
      city: row.city?.trim() || undefined,
      address: row.address?.trim() || '',
      description: row.description?.trim() || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
      source: row.source?.trim() || 'curated-official',
      sourceUrl: row.sourceUrl?.trim() || '',
      lastUpdated: row.lastUpdated?.trim() || '',
    };
    if (row.latitude != null && Number.isFinite(row.latitude)) {
      spot.latitude = row.latitude;
    }
    if (row.longitude != null && Number.isFinite(row.longitude)) {
      spot.longitude = row.longitude;
    }
    if (typeof row.indoor === 'boolean') {
      spot.indoor = row.indoor;
    }
    if (typeof row.parking === 'boolean') {
      spot.parking = row.parking;
    }
    if (row.costLevel) {
      spot.costLevel = row.costLevel;
    }
    if (typeof row.verified === 'boolean') {
      spot.verified = row.verified;
    }
    if (row.confidence) {
      spot.confidence = row.confidence;
    }
    applySafeIndoorInference(spot);
    spots.push(spot);
  }
  return spots;
}
