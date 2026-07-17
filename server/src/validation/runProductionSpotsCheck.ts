/**
 * Production 6-city spot load self-check (no new test libraries).
 * Run: npx tsx src/validation/runProductionSpotsCheck.ts
 */
import { SpotService } from '../services/SpotService';
import {
  applyScenarioFilter,
  buildScenarioFilterContextFromEnvelope,
  detectRainyWeather,
  takePromptCandidates,
} from '../filters/ScenarioFilter';
import { selectDiversePromptCandidates } from '../filters/selectDiversePromptCandidates';
import { mergeAndDeduplicateSpots } from '../services/mergeSpots';
import { buildConstraintEnvelope } from '../constraints/scenarioProfiles';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const service = new SpotService();
const loaded = service.loadProductionSpots();
const cities = Object.keys(loaded.byCity);
assert(cities.length === 6, '6 cities present in byCity');
for (const [city, count] of Object.entries(loaded.byCity)) {
  assert(count > 0, `${city} has >0 spots (${count})`);
}

assert(loaded.merge.afterCount >= 100, `>=100 spots after dedupe (${loaded.merge.afterCount})`);
assert(
  loaded.merge.afterCount <= loaded.merge.beforeCount,
  'dedupe does not increase count'
);

const again = service.loadProductionSpots();
assert(
  again.merge.afterCount === loaded.merge.afterCount,
  'loading twice yields same deduped count'
);

const doubleMerge = mergeAndDeduplicateSpots([loaded.spots, loaded.spots]);
assert(
  doubleMerge.afterCount === loaded.merge.afterCount,
  'merging same set twice does not duplicate'
);

assert(
  loaded.spots.every((s) => s.source !== 'sample'),
  'production spots exclude sample source'
);
assert(
  loaded.spots.every((s) => !String(s.id).startsWith('sample-')),
  'no sample-* ids in production'
);

const categories = new Set(loaded.spots.map((s) => s.category));
assert(categories.size >= 3, `multiple categories (${[...categories].join(',')})`);
assert(
  loaded.spots.some((s) => s.indoor === true),
  'has indoor candidates'
);
assert(
  loaded.spots.some((s) => s.category === 'park' || s.category === 'playground'),
  'has park/playground'
);
assert(
  loaded.spots.some(
    (s) =>
      s.category === 'museum' ||
      s.category === 'zoo' ||
      s.category === 'library' ||
      s.category === 'experience'
  ),
  'has non-park culture/animal/library/experience'
);

const envelope = buildConstraintEnvelope('strict', {
  startTime: '10:00',
  endTime: '16:00',
  departurePlace: '愛知県刈谷市',
  budget: '15000円',
  transport: '車',
});
const ranked = applyScenarioFilter(
  loaded.spots,
  buildScenarioFilterContextFromEnvelope(envelope, { weather: '晴れ' })
);
const diversified = selectDiversePromptCandidates(ranked, {
  limit: 20,
  maxPerCategory: 6,
  preferIndoorConcentration: detectRainyWeather('晴れ') === true,
});
assert(diversified.length <= 20, `prompt candidates <=20 (${diversified.length})`);
assert(diversified.length > 0, 'prompt candidates >0');

const promptCats = new Set(diversified.map((s) => s.spot.category));
assert(
  promptCats.size >= 2,
  `prompt candidates not single-category (${[...promptCats].join(',')})`
);

const nonPark = diversified.some(
  (s) => s.spot.category !== 'park' && s.spot.category !== 'playground'
);
assert(nonPark, 'prompt candidates include non-park categories');

console.log('\nSummary');
console.log(JSON.stringify(loaded.byCity, null, 2));
console.log('before/after dedupe', loaded.merge.beforeCount, loaded.merge.afterCount);
console.log('prompt categories', Object.fromEntries(
  [...promptCats].map((c) => [
    c,
    diversified.filter((s) => s.spot.category === c).length,
  ])
));
console.log('\nAll production spot checks passed.');
