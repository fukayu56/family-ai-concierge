/**
 * Self-check for plan title ↔ content alignment.
 * Run: npx tsx src/validation/runPlanTitleAlignmentCheck.ts
 */
import type { Plan } from '../recommendation-response';
import {
  alignPlanTitleWithContent,
  buildTitleFromPlanContent,
  findUngroundedThemesForPlan,
  type TitleAlignmentSpotLookup,
} from './alignPlanTitleWithContent';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERT: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

function basePlan(overrides: Partial<Plan>): Plan {
  return {
    id: 'p1',
    title: '仮',
    reason: '家族で楽しむ',
    cost: '約5000円',
    spots: '科学館、公園',
    localEnjoymentTime: '3時間',
    roundTripTime: '1時間',
    withinBudget: true,
    timeline: [
      {
        time: '10:00',
        title: '自宅を出発',
        description: '出発します',
        type: 'departure',
      },
      {
        time: '11:00〜13:00',
        title: '科学体験',
        description: '館内で学びます',
        type: 'spot',
      },
      {
        time: '13:00〜14:00',
        title: '昼食',
        description: '食事',
        type: 'meal',
      },
      {
        time: '14:00〜15:00',
        title: '遊具や自然',
        description: '公園で遊びます',
        type: 'spot',
      },
      {
        time: '16:00',
        title: '帰宅',
        description: '帰宅します',
        type: 'return',
      },
    ],
    ...overrides,
  };
}

// Case 1: dinosaur title vs science+park content → correct
{
  const plan = basePlan({
    title: '恐竜体験で発見を楽しむプラン',
    spots: '夢と学びの科学体験館、ミササガパーク',
    reason: '科学体験と公園遊びが中心です',
  });
  const ungrounded = findUngroundedThemesForPlan(plan);
  assert(ungrounded.some((theme) => theme.id === 'dinosaur'), 'case1 ungrounded dinosaur');
  const result = alignPlanTitleWithContent(plan, { planIndex: 0, log: false });
  assert(result.corrected, 'case1 corrected');
  assert(!result.plan.title.includes('恐竜'), 'case1 title without 恐竜');
  assert(
    result.plan.title.includes('科学') || result.plan.title.includes('公園'),
    'case1 title grounded'
  );
  assert(result.plan.spots === plan.spots, 'case1 spots unchanged');
}

// Case 2: science+park title matches content → keep
{
  const plan = basePlan({
    title: '科学体験と公園遊びを楽しむプラン',
    spots: '科学館、公園',
  });
  const result = alignPlanTitleWithContent(plan, { log: false });
  assert(!result.corrected, 'case2 unchanged');
  assert(result.plan.title === plan.title, 'case2 title kept');
}

// Case 3: dinosaur title with dinosaur tag on matched spot → keep
{
  const lookup: TitleAlignmentSpotLookup[] = [
    {
      name: '恐竜博物館',
      category: 'museum',
      tags: ['恐竜', '化石'],
      description: '恐竜展示',
    },
  ];
  const plan = basePlan({
    title: '恐竜を学ぶプラン',
    spots: '恐竜博物館',
    timeline: [
      {
        time: '11:00〜13:00',
        title: '展示見学',
        description: '館内を見学します',
        type: 'spot',
      },
    ],
  });
  const result = alignPlanTitleWithContent(plan, {
    spotLookup: lookup,
    log: false,
  });
  assert(!result.corrected, 'case3 kept when tags include 恐竜');
  assert(result.plan.title === plan.title, 'case3 title kept');
}

// Case 4: waterplay title without water evidence → correct
{
  const plan = basePlan({
    title: '水遊び満喫プラン',
    spots: '科学館、公園',
    reason: '屋内見学と遊具',
  });
  const result = alignPlanTitleWithContent(plan, { log: false });
  assert(result.corrected, 'case4 corrected');
  assert(!result.plan.title.includes('水遊び'), 'case4 no 水遊び');
}

// Case 5: vehicle title with railway tag → keep
{
  const lookup: TitleAlignmentSpotLookup[] = [
    {
      name: '鉄道博物館',
      category: 'museum',
      tags: ['電車', '鉄道', '乗り物'],
      description: '車両展示',
    },
  ];
  const plan = basePlan({
    title: '乗り物を楽しむプラン',
    spots: '鉄道博物館',
    timeline: [
      {
        time: '11:00〜13:00',
        title: '展示',
        description: '車両を見ます',
        type: 'spot',
      },
    ],
  });
  const result = alignPlanTitleWithContent(plan, {
    spotLookup: lookup,
    log: false,
  });
  assert(!result.corrected, 'case5 kept with vehicle tags');
}

// Deterministic builder smoke
{
  const plan = basePlan({
    spots: '科学館、中央公園',
  });
  const lookup: TitleAlignmentSpotLookup[] = [
    {
      name: '科学館',
      category: 'museum',
      tags: ['科学'],
      description: '',
    },
    {
      name: '中央公園',
      category: 'park',
      tags: ['遊具'],
      description: '',
    },
  ];
  const title = buildTitleFromPlanContent(plan, lookup);
  assert(
    title.includes('科学体験') && title.includes('公園遊び'),
    `builder uses categories (${title})`
  );
}

// Hallucinated dinosaur in reason/timeline must not ground title when spot tags lack it
{
  const lookup: TitleAlignmentSpotLookup[] = [
    {
      name: '東山動植物園',
      category: 'zoo',
      tags: ['動物園', '植物園', '子ども'],
      description: '名古屋市公式の動植物園。家族向けの動物・植物観察施設。',
    },
    {
      name: '洲原公園',
      category: 'park',
      tags: [],
      description: 'お花見スポットとしても親しまれている公園',
    },
  ];
  const plan = basePlan({
    title: '恐竜体験と公園遊びを楽しむプラン',
    spots: '東山動植物園, 洲原公園',
    reason:
      '長男が恐竜に興味を持っていることから、午前中の恐竜体験を通じて興味を引き出します。',
    timeline: [
      {
        time: '11:00〜12:00',
        title: '恐竜や動物を観察',
        description: '展示を見て学びます',
        type: 'spot',
      },
      {
        time: '14:00〜15:00',
        title: '洲原公園で遊ぶ',
        description: '遊具や広場で自由に遊びます',
        type: 'spot',
      },
    ],
  });
  const result = alignPlanTitleWithContent(plan, {
    spotLookup: lookup,
    log: false,
  });
  assert(result.corrected, 'hallucinated dinosaur corrected');
  assert(!result.plan.title.includes('恐竜'), 'hallucinated dinosaur removed from title');
  assert(
    result.plan.title.includes('動物') || result.plan.title.includes('公園'),
    `hallucinated case grounded title (${result.plan.title})`
  );
  assert(result.plan.timeline[0].title.includes('恐竜'), 'timeline left unchanged');
}

console.log('runPlanTitleAlignmentCheck: PASS');
