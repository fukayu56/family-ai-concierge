import type { SpotCandidate } from '../models/SpotCandidate';
import type { Plan } from '../recommendation-response';

/**
 * Theme vocabulary for title↔content alignment.
 * Title markers: words that claim the theme in the plan title.
 * Content markers: evidence that must appear in spots / timeline / reason / matched spot metadata.
 */
export type TitleTheme = {
  id: string;
  titleMarkers: string[];
  contentMarkers: string[];
};

export const TITLE_THEMES: TitleTheme[] = [
  {
    id: 'dinosaur',
    titleMarkers: ['恐竜'],
    contentMarkers: ['恐竜', 'ダイナソー', '化石'],
  },
  {
    id: 'animal',
    titleMarkers: ['動物', '動物園', 'ふれあい'],
    contentMarkers: ['動物', '動物園', 'ふれあい', 'zoo'],
  },
  {
    id: 'waterplay',
    titleMarkers: ['水遊び', 'プール', '噴水'],
    contentMarkers: ['水遊び', 'プール', '噴水', '水辺', 'じゃぶじゃぶ'],
  },
  {
    id: 'craft',
    titleMarkers: ['工作', 'クラフト', 'ものづくり'],
    contentMarkers: ['工作', 'クラフト', 'ものづくり', 'ワークショップ'],
  },
  {
    id: 'vehicle',
    titleMarkers: ['乗り物', '電車', '鉄道', '汽車', 'バス', '飛行機'],
    contentMarkers: [
      '乗り物',
      '電車',
      '鉄道',
      '汽車',
      'バス',
      '飛行機',
      'トレイン',
      '車両',
    ],
  },
  {
    id: 'science',
    titleMarkers: ['科学', '科学館', 'サイエンス'],
    contentMarkers: ['科学', '科学館', 'サイエンス', '実験', 'プラネタリウム'],
  },
  {
    id: 'nature',
    titleMarkers: ['自然', '森', '里山'],
    contentMarkers: ['自然', '森', '里山', '緑地', '自然観察'],
  },
  {
    id: 'park',
    titleMarkers: ['公園', '遊具'],
    contentMarkers: ['公園', '遊具', '広場', 'パーク'],
  },
  {
    id: 'onsen',
    titleMarkers: ['温泉', '銭湯'],
    contentMarkers: ['温泉', '銭湯', '入浴', 'スパ'],
  },
  {
    id: 'sea',
    titleMarkers: ['海', '海辺', '海岸', 'ビーチ'],
    contentMarkers: ['海', '海辺', '海岸', 'ビーチ', '水族館', '潮風'],
  },
  {
    id: 'farm',
    titleMarkers: ['農業', '農園', '収穫', 'いちご狩り', '果物狩り'],
    contentMarkers: ['農業', '農園', '収穫', 'いちご', '果物狩り', '畑'],
  },
  {
    id: 'food',
    titleMarkers: ['食体験', 'グルメ', '料理体験'],
    contentMarkers: ['食体験', 'グルメ', '料理', '試食', 'フード'],
  },
];

export type TitleAlignmentSpotLookup = Pick<
  SpotCandidate,
  'name' | 'category' | 'tags' | 'description'
>;

export type TitleAlignmentResult = {
  plan: Plan;
  corrected: boolean;
  originalTitle: string;
  correctedTitle: string;
  reasonCategory: 'ungrounded_theme' | 'unchanged';
  ungroundedThemeIds: string[];
};

function normalizeForMatch(text: string): string {
  return text.toLowerCase();
}

function includesAny(haystack: string, needles: string[]): boolean {
  const normalized = normalizeForMatch(haystack);
  return needles.some((needle) =>
    normalized.includes(normalizeForMatch(needle))
  );
}

/** Themes claimed by the plan title. */
export function findThemesInTitle(title: string): TitleTheme[] {
  return TITLE_THEMES.filter((theme) =>
    includesAny(title, theme.titleMarkers)
  );
}

/**
 * Spot-grounded evidence only: plan.spots + matched candidate metadata.
 * Used when spot lookup matches, so AI-invented themes in reason/timeline
 * cannot alone justify a title theme word.
 */
export function buildSpotGroundedEvidence(
  plan: Plan,
  spotLookup: TitleAlignmentSpotLookup[] = []
): string {
  const matchedMeta = matchSpotMetadata(plan, spotLookup)
    .map(
      (spot) =>
        `${spot.name} ${spot.category} ${categoryLabel(spot.category)} ${(spot.tags ?? []).join(' ')} ${spot.description ?? ''}`
    )
    .join(' ');
  return `${plan.spots} ${matchedMeta}`;
}

/**
 * Full plan text evidence (spots + reason + timeline + matched metadata).
 * Fallback when no spot candidates match by name.
 * Does not invent themes from family likes.
 */
export function buildPlanContentEvidence(
  plan: Plan,
  spotLookup: TitleAlignmentSpotLookup[] = []
): string {
  const timelineText = plan.timeline
    .map((item) => `${item.title} ${item.description}`)
    .join(' ');
  return `${buildSpotGroundedEvidence(plan, spotLookup)} ${plan.reason} ${timelineText}`;
}

/**
 * Evidence used for title theme grounding.
 * Prefer spot-grounded text when candidates match; otherwise full plan text.
 */
export function buildTitleGroundingEvidence(
  plan: Plan,
  spotLookup: TitleAlignmentSpotLookup[] = []
): string {
  const matched = matchSpotMetadata(plan, spotLookup);
  if (matched.length > 0) {
    return buildSpotGroundedEvidence(plan, spotLookup);
  }
  return buildPlanContentEvidence(plan, spotLookup);
}

export function matchSpotMetadata(
  plan: Plan,
  spotLookup: TitleAlignmentSpotLookup[]
): TitleAlignmentSpotLookup[] {
  if (spotLookup.length === 0) {
    return [];
  }
  const haystack = `${plan.spots} ${plan.timeline.map((item) => item.title).join(' ')}`;
  return spotLookup.filter((spot) => haystack.includes(spot.name));
}

export function findUngroundedThemes(
  title: string,
  evidence: string
): TitleTheme[] {
  return findThemesInTitle(title).filter(
    (theme) => !includesAny(evidence, theme.contentMarkers)
  );
}

export function findUngroundedThemesForPlan(
  plan: Plan,
  spotLookup: TitleAlignmentSpotLookup[] = []
): TitleTheme[] {
  return findUngroundedThemes(
    plan.title,
    buildTitleGroundingEvidence(plan, spotLookup)
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  museum: '科学体験',
  park: '公園遊び',
  playground: '遊具遊び',
  zoo: '動物とのふれあい',
  library: '図書館',
  experience: '体験',
  sightseeing: '見学',
  aquarium: '水族館',
  other: 'おでかけ',
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? 'おでかけ';
}

/**
 * Deterministic safe title from plan content (no OpenAI, no family likes).
 */
export function buildTitleFromPlanContent(
  plan: Plan,
  spotLookup: TitleAlignmentSpotLookup[] = []
): string {
  const matched = matchSpotMetadata(plan, spotLookup);
  const labels: string[] = [];

  for (const spot of matched) {
    const label = categoryLabel(spot.category);
    if (!labels.includes(label)) {
      labels.push(label);
    }
    if (labels.length >= 2) {
      break;
    }
  }

  if (labels.length === 0) {
    const evidence = buildPlanContentEvidence(plan, spotLookup);
    const fallbackOrder = [
      'science',
      'park',
      'animal',
      'vehicle',
      'craft',
      'nature',
      'sea',
      'waterplay',
      'farm',
      'food',
      'onsen',
      'dinosaur',
    ] as const;
    for (const id of fallbackOrder) {
      const theme = TITLE_THEMES.find((entry) => entry.id === id);
      if (theme && includesAny(evidence, theme.contentMarkers)) {
        const label =
          id === 'science'
            ? '科学体験'
            : id === 'park'
              ? '公園遊び'
              : id === 'animal'
                ? '動物とのふれあい'
                : id === 'vehicle'
                  ? '乗り物'
                  : id === 'craft'
                    ? '工作体験'
                    : id === 'nature'
                      ? '自然散策'
                      : id === 'sea'
                        ? '海辺'
                        : id === 'waterplay'
                          ? '水遊び'
                          : id === 'farm'
                            ? '農園体験'
                            : id === 'food'
                              ? '食体験'
                              : id === 'onsen'
                                ? '温泉'
                                : '恐竜体験';
        if (!labels.includes(label)) {
          labels.push(label);
        }
      }
      if (labels.length >= 2) {
        break;
      }
    }
  }

  if (labels.length === 0) {
    const primarySpot = plan.spots
      .split(/[、,／/]/)
      .map((part) => part.trim())
      .find((part) => part.length > 0);
    if (primarySpot) {
      const short =
        primarySpot.length > 12 ? `${primarySpot.slice(0, 12)}…` : primarySpot;
      return `${short}を楽しむプラン`;
    }
    return '家族で楽しむおでかけプラン';
  }

  if (labels.length === 1) {
    return `${labels[0]}を楽しむプラン`;
  }
  return `${labels[0]}と${labels[1]}を楽しむプラン`;
}

/**
 * If the title claims themes not grounded in plan content, replace with a
 * deterministic content-based title. Never changes spots/timeline/reason.
 */
export function alignPlanTitleWithContent(
  plan: Plan,
  options: {
    planIndex?: number;
    spotLookup?: TitleAlignmentSpotLookup[];
    log?: boolean;
  } = {}
): TitleAlignmentResult {
  const spotLookup = options.spotLookup ?? [];
  const ungrounded = findUngroundedThemesForPlan(plan, spotLookup);

  if (ungrounded.length === 0) {
    return {
      plan,
      corrected: false,
      originalTitle: plan.title,
      correctedTitle: plan.title,
      reasonCategory: 'unchanged',
      ungroundedThemeIds: [],
    };
  }

  const correctedTitle = buildTitleFromPlanContent(plan, spotLookup);
  if (options.log !== false) {
    const indexLabel =
      options.planIndex != null ? String(options.planIndex) : '?';
    console.log(
      `[title-alignment] plan=${indexLabel} original="${plan.title}" corrected="${correctedTitle}" reason=ungrounded_theme themes=${ungrounded.map((theme) => theme.id).join(',')}`
    );
  }

  return {
    plan: {
      ...plan,
      title: correctedTitle,
    },
    corrected: true,
    originalTitle: plan.title,
    correctedTitle,
    reasonCategory: 'ungrounded_theme',
    ungroundedThemeIds: ungrounded.map((theme) => theme.id),
  };
}

export function alignPlansTitles(
  plans: Plan[],
  spotLookup: TitleAlignmentSpotLookup[] = []
): Plan[] {
  return plans.map((plan, index) => {
    return alignPlanTitleWithContent(plan, {
      planIndex: index,
      spotLookup,
    }).plan;
  });
}
