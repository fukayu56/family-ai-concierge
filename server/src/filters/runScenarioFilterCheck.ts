/**
 * ScenarioFilter v1 self-check (no test framework / no new libraries).
 * Run: npx tsx src/filters/runScenarioFilterCheck.ts
 */
import type { SpotCandidate } from '../models/SpotCandidate';
import {
  applyScenarioFilter,
  detectRainyWeather,
  resolveAttributeEvidence,
  type ScenarioFilterContext,
} from './ScenarioFilter';

function baseSpot(overrides: Partial<SpotCandidate> & Pick<SpotCandidate, 'id' | 'name'>): SpotCandidate {
  return {
    category: 'other',
    address: 'test',
    description: 'test spot',
    tags: [],
    source: 'sample',
    sourceUrl: 'https://example.local',
    lastUpdated: '2026-07-17',
    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

function scoresEqual(a: number, b: number): boolean {
  return a === b;
}

function run(): void {
  const rainyCtx: ScenarioFilterContext = {
    weather: '雨のち曇り',
    transport: '電車',
    budgetMax: 15_000,
  };
  const sunnyCtx: ScenarioFilterContext = {
    weather: '晴れ',
    transport: '電車',
    budgetMax: 15_000,
  };
  const carCtx: ScenarioFilterContext = {
    weather: '晴れ',
    transport: '車',
    budgetMax: 15_000,
  };
  const lowBudgetCtx: ScenarioFilterContext = {
    weather: '晴れ',
    transport: '電車',
    budgetMax: 8_000,
  };

  // 1. Rain + indoor verified
  {
    const spot = baseSpot({
      id: '1',
      name: 'verified indoor',
      indoor: true,
      confidence: 'verified',
    });
    const scored = applyScenarioFilter([spot], rainyCtx)[0];
    assert(scored.score === 3, 'rain + indoor verified => +3');
    assert(
      scored.reasons.some((r) => r.includes('verified')),
      'rain verified reason mentions verified'
    );
  }

  // 2. Rain + indoor inferred
  {
    const spot = baseSpot({
      id: '2',
      name: 'inferred indoor',
      indoor: true,
      confidence: 'inferred',
    });
    const scored = applyScenarioFilter([spot], rainyCtx)[0];
    assert(scored.score === 1, 'rain + indoor inferred => +1');
    assert(
      scored.reasons.some((r) => r.includes('推測')),
      'inferred reason distinguishes speculation'
    );
  }

  // 3. Rain + indoor false
  {
    const spot = baseSpot({
      id: '3',
      name: 'outdoor',
      indoor: false,
      confidence: 'inferred',
    });
    const scored = applyScenarioFilter([spot], rainyCtx)[0];
    assert(scored.score === -1, 'rain + indoor false => -1');
  }

  // 4. Rain + indoor undefined
  {
    const spot = baseSpot({ id: '4', name: 'unknown indoor' });
    const scored = applyScenarioFilter([spot], rainyCtx)[0];
    assert(scored.score === 0, 'rain + indoor undefined => 0');
    assert(scored.reasons.length === 0, 'unknown indoor adds no reasons');
  }

  // 5. Sunny + indoor true (no penalty)
  {
    const spot = baseSpot({
      id: '5',
      name: 'sunny indoor',
      indoor: true,
      confidence: 'verified',
    });
    const scored = applyScenarioFilter([spot], sunnyCtx)[0];
    assert(scored.score === 0, 'sunny does not penalize indoor');
  }

  // 6. Car + parking true
  {
    const spot = baseSpot({ id: '6', name: 'parking yes', parking: true });
    const scored = applyScenarioFilter([spot], carCtx)[0];
    assert(scored.score === 1, 'car + parking true => +1');
  }

  // 7. parking undefined
  {
    const spot = baseSpot({ id: '7', name: 'parking unknown' });
    const scored = applyScenarioFilter([spot], carCtx)[0];
    assert(scored.score === 0, 'parking undefined => no change');
  }

  // 8. Low budget + free
  {
    const spot = baseSpot({ id: '8', name: 'free', costLevel: 'free' });
    const scored = applyScenarioFilter([spot], lowBudgetCtx)[0];
    assert(scored.score === 1, 'low budget + free => +1');
  }

  // 9. Low budget + high
  {
    const spot = baseSpot({ id: '9', name: 'high', costLevel: 'high' });
    const scored = applyScenarioFilter([spot], lowBudgetCtx)[0];
    assert(scored.score === -1, 'low budget + high => -1');
  }

  // 10. Stable order on ties
  {
    const a = baseSpot({ id: 'a', name: 'A' });
    const b = baseSpot({ id: 'b', name: 'B' });
    const c = baseSpot({ id: 'c', name: 'C' });
    const ranked = applyScenarioFilter([a, b, c], sunnyCtx);
    assert(
      ranked.map((r) => r.spot.id).join(',') === 'a,b,c',
      'ties keep original order'
    );
  }

  // 11. Non-destructive
  {
    const spot = baseSpot({
      id: 'mut',
      name: 'immutable',
      indoor: true,
      confidence: 'inferred',
    });
    const before = JSON.stringify(spot);
    applyScenarioFilter([spot], rainyCtx);
    assert(JSON.stringify(spot) === before, 'SpotCandidate not mutated');
  }

  // Evidence helper
  assert(
    resolveAttributeEvidence(
      baseSpot({ id: 'e1', name: 'e', confidence: 'verified', verified: false })
    ) === 'verified',
    'confidence prefers confidence=verified'
  );
  assert(
    resolveAttributeEvidence(
      baseSpot({ id: 'e2', name: 'e', verified: true })
    ) === 'verified',
    'evidence uses verified=true'
  );
  assert(
    resolveAttributeEvidence(
      baseSpot({ id: 'e3', name: 'e', confidence: 'inferred' })
    ) === 'inferred',
    'evidence uses inferred'
  );
  assert(
    resolveAttributeEvidence(baseSpot({ id: 'e4', name: 'e' })) === 'unknown',
    'evidence defaults to unknown'
  );

  assert(detectRainyWeather('今日は雨') === true, 'detect rain');
  assert(detectRainyWeather('晴れ') === false, 'detect sunny');
  assert(detectRainyWeather(undefined) === undefined, 'missing weather');

  // Mixed ranking: verified indoor should outrank inferred on rain
  {
    const inferred = baseSpot({
      id: 'inf',
      name: 'inferred',
      indoor: true,
      confidence: 'inferred',
    });
    const verified = baseSpot({
      id: 'ver',
      name: 'verified',
      indoor: true,
      confidence: 'verified',
    });
    const outdoor = baseSpot({
      id: 'out',
      name: 'outdoor',
      indoor: false,
    });
    // Original order: inferred, outdoor, verified
    const ranked = applyScenarioFilter([inferred, outdoor, verified], rainyCtx);
    assert(
      ranked.map((r) => r.spot.id).join(',') === 'ver,inf,out',
      'rain ranks verified > inferred > outdoor'
    );
    assert(scoresEqual(ranked[0].score, 3), 'top score is 3');
    assert(scoresEqual(ranked[1].score, 1), 'second score is 1');
    assert(scoresEqual(ranked[2].score, -1), 'outdoor score is -1');
  }

  console.log('\nAll ScenarioFilter v1 checks passed.');
}

run();
