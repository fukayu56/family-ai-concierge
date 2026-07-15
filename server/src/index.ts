import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import OpenAI from 'openai';

import {
  type Plan,
  type RecommendationResponse,
  recommendationResponseSchema,
  validateRecommendationResponse,
} from './recommendation-response';
import { validateRecommendationBusinessRules } from './recommendation-business-validation';

dotenv.config();

const openAiApiKey = process.env.OPENAI_API_KEY;
console.log(
  openAiApiKey && openAiApiKey.trim() !== ''
    ? 'OpenAI API Key: Loaded'
    : 'OpenAI API Key: Missing'
);

const openAIModel = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
console.log(`OpenAI Model: ${openAIModel}`);

const openai = new OpenAI({
  apiKey: openAiApiKey,
});

/** Used with OpenAI Structured Outputs `response_format.json_schema`. */
export { recommendationResponseSchema };

type OutingConditions = {
  startTime: string;
  endTime: string;
  departurePlace: string;
  budget: string;
  transport: string;
  specialRequests: string;
};

type FamilyMemberProfile = {
  id: string;
  name: string;
  age: number | null;
  likes: string;
  gender: string;
  favoriteFoods: string;
  dislikedFoods: string;
  allergies: string;
  favoritePlay: string;
  dislikedPlay: string;
  interests: string;
  canTolerate: string;
  cannotTolerate: string;
};

/**
 * Optional context that may enrich AI recommendations later.
 * Not fetched yet — clients may omit all of these fields.
 */
export type RecommendationEnrichment = {
  /** Future source: OpenWeatherMap / WeatherAPI / 気象庁API */
  weather?: string;
  /** Future source: Google Maps Directions API / 交通情報API */
  traffic?: string;
  /** Future source: Google Places Popular Times / 混雑予想API */
  congestion?: string;
  /** Future source: Google Places API (reviews) / 口コミAPI */
  reviews?: string;
  /** Future source: Google Places API (opening_hours) */
  businessHours?: string;
  /** Future source: Google Places API / NAVITIME 駐車場API */
  parking?: string;
  /** Future source: Google Places API (price_level) */
  priceLevel?: string;
  /** Future source: Google Events / 自治体オープンデータ・イベントAPI */
  specialEvents?: string;
};

/** Request body from the Expo app for plan recommendations. */
export type RecommendationRequest = {
  conditions: OutingConditions;
  participants: FamilyMemberProfile[];
} & RecommendationEnrichment;

function hasEnrichmentValue(value: string | undefined): value is string {
  return value != null && value.trim() !== '';
}

/**
 * Build a Japanese prompt for generating 3 family outing plans.
 * Tomorrow: send this string to OpenAI, with recommendationResponseSchema
 * as Structured Outputs json_schema.
 */
export function buildRecommendationPrompt(
  conditions: OutingConditions,
  participants: FamilyMemberProfile[],
  enrichment: RecommendationEnrichment = {}
): string {
  const participantList =
    participants.length === 0
      ? '- （参加者なし）'
      : participants
          .map((member, index) => {
            const ageLabel =
              member.age != null ? `${member.age}歳` : '年齢未設定';
            return `- ${index + 1}. ${member.name}（${ageLabel}）`;
          })
          .join('\n');

  const participantProfiles =
    participants.length === 0
      ? '- （参加者プロフィールなし）'
      : participants
          .map((member, index) => {
            const ageLabel =
              member.age != null ? `${member.age}歳` : '年齢未設定';
            return [
              `### ${index + 1}. ${member.name}`,
              `- 年齢: ${ageLabel}`,
              `- 性別: ${member.gender || '未設定'}`,
              `- 好きなこと: ${member.likes || '未設定'}`,
              `- 好きな食べ物: ${member.favoriteFoods || '未設定'}`,
              `- 嫌いな食べ物: ${member.dislikedFoods || '未設定'}`,
              `- アレルギー: ${member.allergies || 'なし'}`,
              `- 好きな遊び: ${member.favoritePlay || '未設定'}`,
              `- 嫌いな遊び: ${member.dislikedPlay || '未設定'}`,
              `- 今興味があるもの: ${member.interests || '未設定'}`,
              `- 耐えられること: ${member.canTolerate || '未設定'}`,
              `- 耐えられないこと: ${member.cannotTolerate || '未設定'}`,
            ].join('\n');
          })
          .join('\n\n');

  const enrichmentLines: string[] = [];
  if (hasEnrichmentValue(enrichment.weather)) {
    enrichmentLines.push(`- 天候: ${enrichment.weather}`);
  }
  if (hasEnrichmentValue(enrichment.traffic)) {
    enrichmentLines.push(`- 交通状況: ${enrichment.traffic}`);
  }
  if (hasEnrichmentValue(enrichment.congestion)) {
    enrichmentLines.push(`- 混雑: ${enrichment.congestion}`);
  }
  if (hasEnrichmentValue(enrichment.reviews)) {
    enrichmentLines.push(`- 口コミ: ${enrichment.reviews}`);
  }
  if (hasEnrichmentValue(enrichment.businessHours)) {
    enrichmentLines.push(`- 営業時間: ${enrichment.businessHours}`);
  }
  if (hasEnrichmentValue(enrichment.parking)) {
    enrichmentLines.push(`- 駐車場: ${enrichment.parking}`);
  }
  if (hasEnrichmentValue(enrichment.priceLevel)) {
    enrichmentLines.push(`- 価格帯: ${enrichment.priceLevel}`);
  }
  if (hasEnrichmentValue(enrichment.specialEvents)) {
    enrichmentLines.push(`- 特別イベント: ${enrichment.specialEvents}`);
  }

  const enrichmentSection =
    enrichmentLines.length > 0
      ? ['', '## 参考情報（取得済みの場合のみ）', ...enrichmentLines]
      : [];

  return [
    '## 役割',
    'あなたは日本一優秀な家族向けコンシェルジュです。',
    '家族全員の希望・制約・体力・好みのバランスを見極め、満足度の高いおでかけを設計してください。',
    '',
    '## 目的',
    '家族全員が満足できる、1日のおでかけプランを提案する。',
    '',
    '## 出力形式',
    '次のJSONオブジェクトのみを返す。',
    '{',
    '  "plans": [',
    '    {',
    '      "id": "string",',
    '      "title": "string",',
    '      "reason": "string",',
    '      "cost": "string",',
    '      "spots": "string",',
    '      "localEnjoymentTime": "string",',
    '      "roundTripTime": "string",',
    '      "withinBudget": true,',
    '      "timeline": [',
    '        {',
    '          "time": "string",',
    '          "title": "string",',
    '          "description": "string",',
    '          "type": "departure" | "spot" | "meal" | "return"',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    '## 考慮事項',
    'プラン作成時は、少なくとも次をすべて踏まえること。',
    '- 営業時間: 施設・飲食店が営業している時間内に収める',
    '- 移動時間: 指定の移動手段での行き帰り時間を現実的に見積もる',
    '- 予算: 指定予算内に収まるか判定し、withinBudget に反映する',
    '- 年齢: 参加者の年齢に適した施設・アクティビティを選ぶ',
    '- 興味: 各参加者の興味・好きなこと・好きな遊びをプランに織り込む',
    '- アレルギー: 食事や体験でアレルギー・苦手な食べ物に配慮する',
    '- 待ち時間: 長時間待ちが出やすいスポットは避け、必要なら時間帯を工夫する',
    '- 天候: 屋外中心か屋内中心か、天候リスクを意識して選ぶ',
    '- 口コミ: 参考情報に口コミがある場合のみ内容を考慮する。ない場合は断定しない',
    '- 混雑: 混雑しやすい場所・時間帯を避け、快適に過ごせる動線にする',
    '- 安全性: 子どもを含む家族での安全性を確認する',
    '- 体験バランス: 誰か一人だけが楽しむプランにせず、家族全員が満たされる構成にする',
    '- 昼食: タイムラインに昼食を含め、アレルギー・好みに合う食事を計画する',
    '',
    '## 参加者一覧',
    participantList,
    '',
    '## 各参加者プロフィール',
    participantProfiles,
    '',
    '## 今日のおでかけ条件',
    `- 出発時間: ${conditions.startTime}`,
    `- 帰着時間: ${conditions.endTime}`,
    `- 出発場所: ${conditions.departurePlace}`,
    `- 予算: ${conditions.budget}円`,
    `- 移動手段: ${conditions.transport}`,
    `- 特別な要望: ${conditions.specialRequests || 'なし'}`,
    ...enrichmentSection,
    '',
    '## 絶対条件（プロダクトルール）',
    `- 帰着時刻（${conditions.endTime}）までに必ず帰宅できるタイムラインにする`,
    '- 往復移動時間を除いた現地で楽しめる時間を localEnjoymentTime に明示する',
    '- 予算内かどうかを withinBudget に明示する',
    '- 参加していない家族メンバーの好みは提案判断に使わない',
    '- 年齢・アレルギー・安全性・体力面の制約を最優先する',
    '- 確認できない営業時間・料金・口コミ・混雑を事実として断定しない',
    '- 情報が不足している場合は、不確実であることを reason 等に明示する',
    '',
    '## 回答ルール',
    '- JSON以外の文章を返さない',
    '- Markdownのコードブロック（```）を付けない',
    '- 項目名を変更しない',
    '- 項目を省略しない',
    '- plansは必ず3件',
    '- 各planにtimelineを必ず含める（departure / spot / meal / return をすべて含む）',
    '- timelineのtypeは departure / spot / meal / return のいずれか',
    '- withinBudgetはbooleanとする',
    '- 各プランに、なぜそのプランが家族に合うのか理由（reason）を書く',
    '- reason では家族全体への適合理由に加え、必要に応じて参加者別の適合理由も述べる',
    '- 誰か一人だけに偏りすぎないバランスの良いプランにする',
    '- 日本語で回答する',
  ].join('\n');
}

const dummyPlans: Plan[] = [
  {
    id: 'plan-1',
    title: '恐竜と科学を楽しむ半日プラン',
    reason: '長男の恐竜・体験型施設への興味に合う',
    cost: '12000円',
    spots: '科学館、近隣レストラン',
    localEnjoymentTime: '3時間',
    roundTripTime: '1時間30分',
    withinBudget: true,
    timeline: [
      {
        time: '10:00',
        title: '出発',
        description: '自宅を出発し、科学館へ向かいます',
        type: 'departure',
      },
      {
        time: '10:45',
        title: '科学館に到着',
        description: '入場手続きと館内案内を確認します',
        type: 'spot',
      },
      {
        time: '11:00〜13:00',
        title: '恐竜・科学展示と体験コーナー',
        description: '恐竜展示と体験コーナーを中心に見学します',
        type: 'spot',
      },
      {
        time: '13:10〜14:00',
        title: '近隣レストランで昼食',
        description: '家族でゆっくり昼食を取ります',
        type: 'meal',
      },
      {
        time: '14:00',
        title: '出発',
        description: '帰宅の移動を開始します',
        type: 'departure',
      },
      {
        time: '14:45',
        title: '帰宅',
        description: '自宅に到着します',
        type: 'return',
      },
    ],
  },
  {
    id: 'plan-2',
    title: '動物と公園を楽しむプラン',
    reason: '次男が動物や屋外遊びを楽しめる',
    cost: '8000円',
    spots: '動物園、大型公園',
    localEnjoymentTime: '4時間',
    roundTripTime: '1時間',
    withinBudget: true,
    timeline: [
      {
        time: '10:00',
        title: '出発',
        description: '自宅を出発し、動物園へ向かいます',
        type: 'departure',
      },
      {
        time: '10:30',
        title: '動物園に到着',
        description: '入場して園内マップを確認します',
        type: 'spot',
      },
      {
        time: '10:30〜12:30',
        title: '動物園',
        description: '人気エリアをまわりながら動物を観察します',
        type: 'spot',
      },
      {
        time: '12:40〜13:30',
        title: '昼食',
        description: '園内または近隣で昼食を取ります',
        type: 'meal',
      },
      {
        time: '13:45〜15:15',
        title: '大型公園',
        description: '遊具や広場で体を動かして遊びます',
        type: 'spot',
      },
      {
        time: '15:30',
        title: '出発',
        description: '帰宅の移動を開始します',
        type: 'departure',
      },
      {
        time: '16:00',
        title: '帰宅',
        description: '自宅に到着します',
        type: 'return',
      },
    ],
  },
  {
    id: 'plan-3',
    title: '雨でも安心の室内体験プラン',
    reason: '天候に左右されず家族全員が楽しめる',
    cost: '15000円',
    spots: '体験型ミュージアム、カフェ',
    localEnjoymentTime: '3時間',
    roundTripTime: '1時間40分',
    withinBudget: true,
    timeline: [
      {
        time: '10:00',
        title: '出発',
        description: '自宅を出発し、体験型ミュージアムへ向かいます',
        type: 'departure',
      },
      {
        time: '10:50',
        title: '体験型ミュージアムに到着',
        description: '入場手続きと体験予約を確認します',
        type: 'spot',
      },
      {
        time: '11:00〜13:00',
        title: '室内体験',
        description: '工作や体験ブースを中心に楽しみます',
        type: 'spot',
      },
      {
        time: '13:10〜14:00',
        title: 'カフェ・昼食',
        description: '館内カフェで休憩と昼食を取ります',
        type: 'meal',
      },
      {
        time: '14:10〜15:00',
        title: '館内を追加見学',
        description: '気になった展示を追加でまわります',
        type: 'spot',
      },
      {
        time: '15:10',
        title: '出発',
        description: '帰宅の移動を開始します',
        type: 'departure',
      },
      {
        time: '16:00',
        title: '帰宅',
        description: '自宅に到着します',
        type: 'return',
      },
    ],
  },
];

const dummyRecommendationResponse: RecommendationResponse = {
  plans: dummyPlans,
};

// Ensure fixed response matches RecommendationResponse (schema-ready).
validateRecommendationResponse(dummyRecommendationResponse);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post('/api/recommendations', async (req: Request, res: Response) => {
  const body = req.body as RecommendationRequest;
  const conditions = body.conditions ?? {
    startTime: '',
    endTime: '',
    departurePlace: '',
    budget: '',
    transport: '',
    specialRequests: '',
  };
  const participants = body.participants ?? [];

  console.log('=== /api/recommendations ===');
  console.log('conditions:', JSON.stringify(conditions, null, 2));
  console.log('participants:', JSON.stringify(participants, null, 2));

  const prompt = buildRecommendationPrompt(conditions, participants, {
    weather: body.weather,
    traffic: body.traffic,
    congestion: body.congestion,
    reviews: body.reviews,
    businessHours: body.businessHours,
    parking: body.parking,
    priceLevel: body.priceLevel,
    specialEvents: body.specialEvents,
  });
  console.log('=== recommendation prompt ===');
  console.log(prompt);

  if (!openAiApiKey || openAiApiKey.trim() === '') {
    console.error('OpenAI recommendation failed', new Error('OPENAI_API_KEY is missing'));
    res.status(500).json({ error: 'プランの取得に失敗しました' });
    return;
  }

  let parsed: unknown;

  try {
    const completion = await openai.chat.completions.create({
      model: openAIModel,
      messages: [
        {
          role: 'system',
          content:
            'あなたは家族向けおでかけコンシェルジュです。必ずJSONオブジェクトだけを返してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'family_outing_recommendations',
          strict: true,
          schema: recommendationResponseSchema,
        },
      },
    });

    const message = completion.choices[0]?.message;

    if (message?.refusal) {
      console.error('OpenAI recommendation refused');
      res.status(500).json({ error: 'プランの取得に失敗しました' });
      return;
    }

    const content = message?.content;
    if (!content) {
      console.error('OpenAI recommendation failed', new Error('Empty content'));
      res.status(500).json({ error: 'プランの取得に失敗しました' });
      return;
    }

    try {
      parsed = JSON.parse(content) as unknown;
    } catch (parseError) {
      console.error('OpenAI recommendation JSON parse failed', parseError);
      res.status(500).json({ error: 'AIの返却形式が不正です' });
      return;
    }
  } catch (error) {
    console.error('OpenAI recommendation failed', error);
    res.status(500).json({ error: 'プランの取得に失敗しました' });
    return;
  }

  console.log('Recommendation response validation started');
  try {
    validateRecommendationResponse(parsed);
    console.log('Recommendation response validation passed');
  } catch (error) {
    console.error('Recommendation response validation failed', error);
    res.status(500).json({ error: 'AIの返却形式が不正です' });
    return;
  }

// ===== テスト用（あとで消す）=====
//(parsed as RecommendationResponse).plans[0].cost = "999999円";
//(parsed as RecommendationResponse).plans[0].withinBudget = true;
// ===============================

  console.log('Recommendation business validation started');
  try {
    validateRecommendationBusinessRules(parsed, conditions);
    console.log('Recommendation business validation passed');
  } catch (error) {
    console.error('Recommendation business validation failed:');
    console.error(error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'AIが生成したプランの内容に矛盾があります',
    });
    return;
  }

  console.log('=== response JSON ===');
  console.log(JSON.stringify(parsed, null, 2));
  res.json(parsed);
});

app.listen(PORT, () => {
  console.log(`Family AI Concierge API listening on http://localhost:${PORT}`);
});
