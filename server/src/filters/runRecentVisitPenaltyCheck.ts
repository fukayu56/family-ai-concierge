/**
 * Lightweight self-check for recent-visit soft penalty.
 * Run: npx tsx src/filters/runRecentVisitPenaltyCheck.ts
 */
import type { SpotCandidate } from '../models/SpotCandidate';
import {
  applyRecentVisitPenalty,
  buildDaysSinceBySpotId,
  collectWantAgainSpotIds,
  RECENT_VISIT_STRONG_PENALTY,
  RECENT_VISIT_WEAK_PENALTY,
} from './applyRecentVisitPenalty';
import type { ScoredSpotCandidate } from './ScenarioFilter';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERT: ${message}`);
  }
}

const baseSpot = (id: string): SpotCandidate => ({
  id,
  name: id,
  category: 'park',
  address: 'addr',
  description: '',
  tags: [],
  source: 'test',
  sourceUrl: 'https://example.local',
  lastUpdated: '2026-01-01',
});

const scored: ScoredSpotCandidate[] = [
  { spot: baseSpot('a'), score: 0, reasons: [] },
  { spot: baseSpot('b'), score: 0, reasons: [] },
  { spot: baseSpot('c'), score: 0, reasons: [] },
];

const today = new Date('2026-07-20T12:00:00');
const daysMap = buildDaysSinceBySpotId(
  [
    { spotId: 'a', visitedOn: '2026-07-15' }, // 5 days → strong
    { spotId: 'b', visitedOn: '2026-06-01' }, // 49 days → weak
    { spotId: 'c', visitedOn: '2026-01-01' }, // old → none
  ],
  today
);

assert(daysMap.get('a') === 5, 'a days');
assert(daysMap.get('b') === 49, 'b days');
assert(daysMap.get('c') === 200, 'c days approx');

const after = applyRecentVisitPenalty(scored, {
  daysSinceBySpotId: daysMap,
  wantAgainSpotIds: new Set(['a']),
});

assert(after.length === 3, 'no hard removal');
assert(
  after.find((e) => e.spot.id === 'a')!.score === RECENT_VISIT_WEAK_PENALTY,
  'wantAgain softens strong to weak'
);
assert(
  after.find((e) => e.spot.id === 'b')!.score === RECENT_VISIT_WEAK_PENALTY,
  'b weak penalty'
);
assert(after.find((e) => e.spot.id === 'c')!.score === 0, 'c no penalty');

const want = collectWantAgainSpotIds([
  { spotId: 'x', wantAgain: true },
  { spotId: 'y', wantAgain: false },
]);
assert(want.has('x') && !want.has('y'), 'wantAgain set');

console.log('runRecentVisitPenaltyCheck: PASS');
