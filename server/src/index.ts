import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import OpenAI from 'openai';

import {
  type Plan,
  type RecommendationResponse,
  type RelaxedPlanEntry,
  recommendationResponseSchema,
  validatePlan,
  validateRecommendationResponse,
} from './recommendation-response';
import {
  aiRecommendationDraftSchema,
  aiRelaxedRecommendationDraftSchema,
  type AiRelaxedRecommendationDraft,
  validateAiRecommendationDraft,
  validateAiRelaxedRecommendationDraft,
} from './recommendation-ai-draft';
import { enrichRecommendationWithCalculatedTimes, enrichSinglePlanDraft } from './recommendation-enrich';
import { validateRecommendationBusinessRules } from './recommendation-business-validation';
import { buildConstraintEnvelope } from './constraints/scenarioProfiles';
import type { ConstraintEnvelope } from './constraints/types';
import type { SpotCandidate } from './models/SpotCandidate';
import { SpotService } from './services/SpotService';
import {
  RelaxedPlanPipelineError,
  logRelaxedPlanFailure,
  validateRelaxedPlanSemanticConsistency,
} from './validation/validateRelaxedPlanSemanticConsistency';
import {
  inspectPlanSimilarity,
  logTimeRelaxationUsage,
} from './validation/inspectPlanSimilarity';

const spotService = new SpotService();

function formatCandidateSpotsSection(spots: SpotCandidate[]): string[] {
  if (spots.length === 0) {
    return [];
  }

  const blocks = spots.map((spot) =>
    [
      `・${spot.name}`,
      `カテゴリ：${spot.category}`,
      '',
      '説明：',
      spot.description,
    ].join('\n')
  );

  return [
    '',
    '## 利用可能な候補スポット',
    '以下の候補を優先して利用してください。',
    '候補が条件に合わない場合のみ、一般的な施設タイプを提案して構いません。',
    '',
    '----------------------------------',
    '',
    blocks.join('\n\n------\n\n'),
    '',
    '----------------------------------',
  ];
}

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

/** Final response schema (kept for app contract / future use). */
export { recommendationResponseSchema };

/** Structured Outputs schema for AI draft responses. */
export { aiRecommendationDraftSchema };

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

type RecommendationPromptMode = 'strict' | 'budget_relaxed' | 'time_relaxed';

type BuildRecommendationPromptOptions = {
  mode?: RecommendationPromptMode;
  strictEnvelope?: ConstraintEnvelope;
};

type RelaxedScenarioId = Exclude<RecommendationPromptMode, 'strict'>;

function buildRelaxedSemanticConsistencyPromptSection(): string[] {
  return [
    '## 緩和プランの意味整合性（必須）',
    'title・reason・spots・timelineは、同じ中心体験を一貫して表現すること。',
    '- titleに含めた中心体験は、必ずspotsとtimelineにも登場させる',
    '- reasonで「追加できる」「確保できる」と説明した体験は、必ずtimelineに含める',
    '- spotsにない施設や体験をreasonで実施済みとして説明しない',
    '- timelineに存在しない恐竜体験・工作体験・動物体験などをtitleへ書かない',
    '- title・reason・spots・timelineで、同じ中心体験を一貫した名称で表現する',
    '',
    '### 生成前の自己確認（必ず行う）',
    'JSONを出力する前に、次を自分で確認すること:',
    '1. titleの中心体験がtimelineのspot/mealイベントに含まれているか',
    '2. reasonで説明した追加体験がtimelineに含まれているか',
    '3. spotsに書いた場所・体験がtimelineで利用されているか',
    '4. title・reason・spots・timelineに矛盾がないか',
    '矛盾がある場合は、titleまたはreasonをtimelineの内容に合わせて修正してから出力する。',
  ];
}

function buildBudgetRelaxationPromptSection(
  strictEnvelope: ConstraintEnvelope,
  budgetEnvelope: ConstraintEnvelope
): string[] {
  const budgetIncrease = budgetEnvelope.budgetMax - strictEnvelope.budgetMax;
  const hint = budgetEnvelope.relaxationHint;

  return [
    '## 条件緩和（budget_relaxed）代表プラン',
    'このプランは、元の予算条件を少し緩和した代表案です。',
    `- 元予算（厳守）: ${strictEnvelope.budgetMax.toLocaleString('ja-JP')}円`,
    `- 緩和後予算上限: ${budgetEnvelope.budgetMax.toLocaleString('ja-JP')}円`,
    `- 増額（サーバー確定値）: ${budgetIncrease.toLocaleString('ja-JP')}円`,
    hint ? `- 緩和の説明: ${hint.label}` : '',
    '',
    '### budget_relaxedの設計ルール',
    '- envelope.budgetMaxを費用の上限として利用する（緩和幅はAIが計算しない）',
    '- 元予算との差額を使うことで可能になる体験を示す',
    '- 単に全体を高額にするのではなく、追加費用の価値が分かる構成にする',
    '- 元のstrict案では実現しにくい体験・施設・食事を1つ以上含める',
    '- 増額で追加する体験は必ずtimelineのspotまたはmealイベントとして明示する',
    '- reasonに書く追加体験は、timeline上のtitleと同じ名称または明確に対応する表現にする',
    '- 緩和後の予算上限を必ず使い切る必要はない',
    '- 追加費用と関係のない通常プランを出さない',
    '- 安全、アレルギー、年齢、cannotTolerateは緩和しない',
    '- 出発時刻・帰宅時刻はstrictと同じ（時間条件は緩和しない）',
    '- costは未確認の概算表現にする',
    '- reason内に書く概算費用とcostは矛盾させない',
    '- 未確認情報を断定しない',
    '',
    '### 他シナリオとの差別化（budget_relaxed）',
    '- 追加予算によって利用可能になる有料体験・追加体験を中心にする',
    '- 時間を増やさなければ成立しない構成にしない（時間条件はstrictと同じ）',
    '- time_relaxedと同じスポット構成を避ける',
    '- 候補データ不足で差別化できない場合は、架空の施設を無理に作らない',
    '',
    '### reasonに必ず含めること',
    `- 元の予算上限は ${strictEnvelope.budgetMax.toLocaleString('ja-JP')}円 と明記する`,
    `- 緩和後の予算上限は ${budgetEnvelope.budgetMax.toLocaleString('ja-JP')}円 と明記する`,
    `- 増額は ${budgetIncrease.toLocaleString('ja-JP')}円 であることを踏まえ、その増額で追加できる具体的な価値を書く`,
    '- 追加体験はtimelineに含まれていること（reasonの体験名とtimeline titleが対応すること）',
    '- その追加体験が、どの参加者に合うかを参加者名つきで説明する',
    '- このプランの費用は未確認の概算であることを自然に書き、reason内の金額表現をcostと矛盾させない',
    '- 元予算へ近づけるための調整案があれば必ず1つ入れる（例: 昼食を持参する、カフェ利用を軽食へ変更する）',
    '',
    '### reasonの書き方の例',
    `- 「元の予算${strictEnvelope.budgetMax.toLocaleString('ja-JP')}円に対し、上限を${budgetEnvelope.budgetMax.toLocaleString('ja-JP')}円まで広げることで、長男向けの体験教室を追加できます。このプランの費用は未確認の概算で約16,000円です。元予算へ近づけるなら昼食を持参に変更できます。」`,
  ];
}

function buildTimeRelaxationPromptSection(
  strictEnvelope: ConstraintEnvelope,
  timeEnvelope: ConstraintEnvelope
): string[] {
  const hint = timeEnvelope.relaxationHint;
  const beforeStart = hint?.before.startTime ?? strictEnvelope.startTime;
  const beforeEnd = hint?.before.endTime ?? strictEnvelope.endTime;
  const afterStart = hint?.after.startTime ?? timeEnvelope.startTime;
  const afterEnd = hint?.after.endTime ?? timeEnvelope.endTime;

  return [
    '## 条件緩和（time_relaxed）代表プラン',
    'このプランは、時間条件だけを緩和した代表案です。',
    `- 元の出発時刻: ${beforeStart}`,
    `- 元の帰宅時刻: ${beforeEnd}`,
    `- 緩和後の出発時刻: ${afterStart}`,
    `- 緩和後の帰宅時刻: ${afterEnd}`,
    `- 元の利用可能時間: ${beforeStart}〜${beforeEnd}`,
    `- 緩和後の利用可能時間: ${afterStart}〜${afterEnd}`,
    hint ? `- 緩和の説明: ${hint.label}` : '',
    `- 予算条件はstrictと同じ（上限 ${strictEnvelope.budgetMax.toLocaleString('ja-JP')}円）`,
    '',
    '### time_relaxedの設計ルール',
    '- 時間条件だけを緩和する（予算はstrictと同じ）',
    '- 時刻差分はサーバー確定値を使う（AIが時刻計算しない）',
    '- strict条件（元の出発・帰宅時刻）では時間不足で実現しにくい体験を1つ以上追加する',
    '- その追加体験をtimelineのspotまたはmealイベントとして明示する（titleに体験名を書く）',
    '- reasonで、早出・遅帰によって追加された時間をどう使ったか具体的に説明する',
    '- 追加時間を単なる自由時間・待ち時間・移動余白だけに使わない',
    '- strictでも同じ内容が容易に成立する場合は、このtime_relaxed案として採用しない',
    '- 緩和後の帰宅時刻まで必ず使い切る必要はない（追加価値が説明できれば早め帰宅も可）',
    '- 安全、アレルギー、年齢、cannotTolerateは緩和しない',
    '- 未確認の営業時間・移動時間・料金は断定しない',
    '- costは未確認の概算表現にする',
    '',
    '### 他シナリオとの差別化（time_relaxed）',
    '- 早出・遅帰によって可能になる時間帯、移動、体験を中心にする',
    '- 単に有料体験を追加しただけの構成にしない（予算はstrictと同じ元予算内を維持する）',
    '- budget_relaxedと同じスポット構成を避ける',
    '- 元予算内を維持する',
    '- 候補データ不足で差別化できない場合は、架空の施設を無理に作らない',
    '',
    '### time_relaxedの追加価値（必須）',
    '単に時刻を広げるだけでは不十分。追加時間で得られる具体的な体験を1つ以上timelineへ入れること。',
    '',
    '良い例:',
    `「${afterStart}出発により午前の工作教室へ参加でき、午後には動物ふれあいも組み込めます。」`,
    '',
    '悪い例:',
    `「${afterStart}に出発し、通常と同じ公園で長く遊びます。」`,
    '',
    '### reasonに必ず含めること',
    `- 元条件（利用可能時間）: ${beforeStart}〜${beforeEnd}`,
    `- 緩和後条件（利用可能時間）: ${afterStart}〜${afterEnd}`,
    `- 出発は ${beforeStart} から ${afterStart} へ、帰宅は ${beforeEnd} から ${afterEnd} へ広げる案であることを書く`,
    '- 追加時間によって可能になった具体的な体験を書く（timeline上のtitleと同じ名称または明確に対応する表現）',
    '- その体験がどの参加者に価値があるかを参加者名つきで説明する',
    '- 元条件へ戻す場合に省略する活動を1つ書く（例: 午後の自由見学を省略する）',
    '',
    '### reasonとtimelineの対応（必須）',
    '- reasonに書く追加体験の名称は、timeline上の該当イベントtitleと同じ名称、または明確に対応する表現にする',
    '- 例: reasonが「工作教室」なら、timelineにも「工作教室」または「工作体験」といった対応するtitleを置く',
    '',
    '### reasonの書き方の例',
    `「通常は${beforeStart}出発・${beforeEnd}帰宅ですが、${afterStart}出発・${afterEnd}帰宅へ広げることで、長男向けの工作体験に加え、次男が楽しめる動物ふれあい時間も確保できます。元の帰宅時刻へ近づける場合は、午後の自由見学を省略できます。」`,
  ];
}

const THREE_PLAN_DIFFERENTIATION_SECTION = [
  '## 3プランの休日体験を差別化する',
  'plansは必ず3件。施設名だけを変えた似たタイムラインは禁止。',
  '各プランで、テーマ・体験の中心・移動回数・滞在時間・休憩・昼食・親子時間・予定変更への強さを変える。',
  '',
  '### プラン1：体験・発見重視',
  '- 子どもの興味や好奇心を中心にする',
  '- 体験、学び、発見がある',
  '- その日の思い出になる中心体験を作る',
  '- ただし、詰め込みすぎない',
  '',
  '### プラン2：余裕・交流重視',
  '- 移動や予定を少なくする',
  '- 家族で会話したり、のんびり過ごせる時間を多くする',
  '- 公園、散歩、カフェ、ピクニックなども候補にする',
  '- 親の負担と子どもの疲労を抑える',
  '- タイムライン上で、次のうち最低2つを必ず反映する:',
  '  1. 活動数を少なくする',
  '  2. 早めに帰宅する',
  '  3. 自由時間を設ける',
  '  4. 移動回数を減らす',
  '  5. 休憩時間を長くする',
  '',
  '### プラン3：安心・柔軟性重視',
  '- 天候変化、子どものぐずり、疲れに対応しやすい',
  '- 屋内、休憩場所、途中退出しやすさを重視する',
  '- 予定を変更しやすい構成にする',
  '- reasonだけでなく、timelineのtitle/descriptionでも任意・短縮可能・休憩へ変更可能であることが分かるようにする',
  '- タイムライン上で、次のうち最低2つを必ず反映する:',
  '  1. 屋内中心',
  '  2. 途中退出しやすい1施設中心',
  '  3. 休憩場所を確保',
  '  4. 30分程度の自由時間または予備時間',
  '  5. 体力があれば追加できる任意活動',
  '  6. 疲れた場合に省略できる活動',
  '  7. 予定より早く帰宅できる余裕',
  '  8. 昼食後の短縮可能な活動',
  '',
  'プラン3の良い例（title/description）:',
  '- 「体力に余裕があれば追加展示」',
  '- 「疲れた場合は休憩または早めの帰宅へ変更」',
  '- 「自由見学・予備時間」',
  '',
  'プラン3の悪い例:',
  '- 通常の活動を並べただけで、reasonにのみ「柔軟」と書く',
  '',
  '参考情報がある場合は軸を調整してよいが、プラン2・3のタイムライン必須特徴は残す。',
];

/**
 * Build a Japanese prompt for generating 3 family outing plan drafts.
 * Emphasizes holiday design (time quality), not spot search.
 * Duration fields are calculated on the server from timeline.
 */
export function buildRecommendationPrompt(
  envelope: ConstraintEnvelope,
  conditions: OutingConditions,
  participants: FamilyMemberProfile[],
  enrichment: RecommendationEnrichment = {},
  candidateSpots: SpotCandidate[] = [],
  promptOptions: BuildRecommendationPromptOptions = {}
): string {
  const mode = promptOptions.mode ?? 'strict';
  const strictEnvelope = promptOptions.strictEnvelope;
  if (
    (mode === 'budget_relaxed' || mode === 'time_relaxed') &&
    strictEnvelope == null
  ) {
    throw new Error(`strictEnvelope is required for ${mode} prompt`);
  }
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
    '## 休日デザインの基本思想',
    '- あなたはスポット検索AIではない',
    '- あなたの役割は、家族の休日全体を設計すること',
    '- スポットは目的ではなく、家族が良い時間を過ごすための手段',
    '- 「どこへ行くか」より「誰が、どんな気持ちで、どんな時間を過ごすか」を重視する',
    '- 家族全員が満足できる体験の流れを設計する',
    '- 体験・食事・休憩・移動のバランスを考える',
    '- 子どもが楽しむだけでなく、親も無理なく楽しめることを重視する',
    '- 予定を詰め込みすぎず、余裕を残す',
    '- 1日の終わりに、家族が「楽しかった」と感じられる流れを作る',
    '',
    '## 出力形式',
    '次のJSONオブジェクトのみを返す。',
    'roundTripTime と localEnjoymentTime は出力しない（サーバー側でtimelineから計算する）。',
    '{',
    '  "plans": [',
    '    {',
    '      "id": "string",',
    '      "title": "string",',
    '      "reason": "string",',
    '      "cost": "string",',
    '      "spots": "string",',
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
    '## 参加者一覧',
    participantList,
    '',
    '## 各参加者プロフィール',
    participantProfiles,
    '',
    '## 今日のおでかけ条件',
    `- 出発時間: ${envelope.startTime}`,
    `- 帰着時間: ${envelope.endTime}`,
    `- 出発場所: ${envelope.departurePlace}`,
    `- 予算: ${envelope.budgetMax}円`,
    `- 移動手段: ${envelope.transport}`,
    `- 特別な要望: ${conditions.specialRequests || 'なし'}`,
    ...enrichmentSection,
    ...formatCandidateSpotsSection(candidateSpots),
    '',
    '## 絶対条件（プロダクトルール）',
    `- 帰着時刻（${envelope.endTime}）までに必ず帰宅できるタイムラインにする`,
    '- 予算内かどうかを withinBudget に明示する（費用は概算として比較する）',
    '- 参加していない家族メンバーの好みは提案判断に使わない',
    '- 確認できない情報を事実として断定しない',
    '- 未設定のプロフィール項目を勝手に補完・捏造しない',
    '',
    '## 制約の優先順位',
    '上位条件と下位条件が両立しない場合は、必ず上位を優先する。',
    '1. 安全性・アレルギー・健康上の制約',
    '2. 指定された帰着時刻',
    '3. 年齢・体力・耐えられないこと（cannotTolerate）',
    '4. 家族全員の満足度',
    '5. 移動負担（canTolerateも参照）',
    '6. 予算',
    '7. スポットの人気や話題性',
    '',
    '条件が厳しい場合は、遠いスポットや体験数を減らし、余裕のあるプランを優先する。',
    '',
    '## 耐性・制約のタイムライン反映',
    '### cannotTolerate',
    '設定がある場合は reason に書くだけでなく、タイムライン設計へ必ず反映する。未設定なら存在しない制約を作らない。',
    '- 長時間待てない → 混雑しやすい体験を避け、短時間で区切れる活動や待ちにくい時間帯を想定',
    '- 長時間歩けない → 移動・歩行を減らし、休憩を入れ、1か所中心にする',
    '- 長時間同じ活動が苦手 → 60〜90分程度で切り替え、食事・休憩・自由時間を挟む',
    '- 人混みが苦手 → 混雑しにくい施設タイプ、広い場所、早い時間帯を優先',
    '',
    '### canTolerate',
    '設定がある場合は許容範囲として使う。未設定なら補完しない。',
    '- 例: 運転2時間まで → 往復移動の目安がその範囲を超えないよう設計',
    '- 例: 徒歩30分まで → 長い散策や広大な施設を避ける',
    '- 外部API未接続のため、正確な移動時間・距離を確認済み事実として断定しない',
    '',
    '## プラン設計の考え方',
    'スポット名を先に決めない。次の順序で考える。',
    '1. この家族が今日どんな時間を過ごすと満足するか',
    '2. 誰のどの希望を中心にするか',
    '3. 他の家族がどこで満足できるか',
    '4. 休憩や昼食をどこに入れるか（食事制約もここで反映）',
    '5. cannotTolerate を踏まえ、疲れ・ぐずりにくい流れか',
    '6. その体験に必要な施設タイプは何か',
    '7. 最後にタイムラインへ落とし込む',
    '',
    '## 家族最適化と title / reason',
    '一般的なおすすめではなく、「この参加者構成だから適している休日」を設計すること。',
    '',
    '### title',
    'titleは抽象的な軸名だけにしない。',
    '悪い例: 「体験・発見重視」「余裕・交流重視」「安心・柔軟性重視」',
    '良い例: 「恐竜体験で発見を楽しむプラン」「近場の公園とカフェでのんびりプラン」「屋内科学館で安心して過ごすプラン」',
    '',
    'titleには次を含める。',
    '- 主要な体験または施設タイプ',
    '- その日の過ごし方',
    '- 20〜30文字程度',
    '- 3プランの違いが一目で分かる表現',
    '',
    '### reason',
    'reason は自然な日本語の短い段落で、施設の特徴だけで終わらせない。',
    'プロフィール制約がタイムライン上のどの工夫に結びついたかを説明する。',
    '可能な限り次を含める（参加者名を使い、一般論だけで終わらせない）。',
    '- この休日のテーマ',
    '- 主役となる参加者と、その理由',
    '- 他の子どもが楽しめるポイント',
    '- ママが満足できるポイント',
    '- パパの移動・費用・負担への配慮',
    '- 疲労やぐずりへの配慮',
    '- cannotTolerate / アレルギー / 苦手への具体的な反映',
    '- 他の2プランとの違い',
    '',
    '良い例:',
    '「次男が長時間同じ活動を続けにくい点を考慮し、午前の体験を90分で区切って昼食と休憩を挟みます。ママのカフェの好みを昼食時間へ取り入れつつ、長男と次男が休める時間としても使います。」',
    '',
    '悪い例:',
    '「恐竜が好きなのでおすすめです。」',
    '「家族全員が楽しめるためおすすめです。」',
    '「アレルギーと体力に配慮しました。」（タイムライン上の工夫がない）',
    '',
    ...(mode === 'strict' ? THREE_PLAN_DIFFERENTIATION_SECTION : []),
    ...(mode === 'budget_relaxed' && strictEnvelope
      ? buildBudgetRelaxationPromptSection(strictEnvelope, envelope)
      : []),
    ...(mode === 'time_relaxed' && strictEnvelope
      ? buildTimeRelaxationPromptSection(strictEnvelope, envelope)
      : []),
    ...(mode === 'budget_relaxed' || mode === 'time_relaxed'
      ? buildRelaxedSemanticConsistencyPromptSection()
      : []),
    '',
    '## 昼食へのプロフィール反映',
    '各プランに meal を含め、参加者の allergies / dislikedFoods / favoriteFoods を考慮する。',
    '- アレルギーがある場合は最優先。対応可否を断定せず、「アレルギー表示を確認できる飲食店を想定」「対応可否は施設へ確認」と書く',
    '- 嫌いな食べ物がある場合は、その食材を中心とした食事を避ける',
    '- 好きな食べ物は、安全性と予算を満たしたうえで候補へ取り入れる',
    '- 未設定の食事情報は勝手に補完しない',
    '- mealのdescriptionには必要に応じて、誰の好みを反映したか、どのアレルギー・苦手へ配慮したか、店舗情報は未確認であることを含める',
    '',
    '## 到達可能範囲と未確認情報の表現',
    `- 出発地（${envelope.departurePlace}）・移動手段（${envelope.transport}）・利用可能時間（${envelope.startTime}〜${envelope.endTime}）を踏まえ、無理なく往復できる範囲だけを提案する`,
    '- 出発地が「自宅」など具体性に欠ける場合は、実在施設名を無理に出さず施設タイプで表現する',
    '  例: 恐竜の体験型施設、家族向けの動物園、屋内型の科学館、近場の大型公園、子ども向け設備のあるカフェ',
    '',
    '次は確認済み事実として断定しない: 実在施設名、営業時間、料金、所要時間、混雑、待ち時間、駐車場、アレルギー対応、設備、イベント開催。',
    '未確認を含む場合は、必要な箇所だけ次の表現を自然に使う（全文章へ同じ注意書きを繰り返さない）。',
    '- 「目安です」「候補です」「事前確認が必要です」',
    '- 「対応可否は施設へ確認してください」',
    '- 「移動時間は概算です」「料金は未確認の概算です」',
    '',
    '### costの表現',
    'costは確定額ではない。必ず次のいずれかの形式にする。',
    '- 「約12,000円」',
    '- 「概算12,000円」',
    '- 「未確認の概算：12,000円」',
    '避け方: 「12,000円」「合計12,000円」だけの断定表現。',
    'withinBudgetは、その概算費用と入力予算の比較として設定する。',
    '',
    '## 考慮事項',
    '- 年齢に適した体験を選ぶ',
    '- 興味・好きなこと・好きな遊びを織り込む',
    '- 天候リスクを意識し、必要なら屋内中心にする',
    '- 参考情報に口コミがある場合のみ内容を考慮する',
    '- 誰か一人だけが楽しむ構成にしない',
    '',
    '## タイムライン設計ルール',
    'timelineは「家族の体験の流れ」として設計する。時間集計はサーバー側で行うため出力しない。',
    '',
    '### 体験の流れ',
    '- 最初から全力で遊ばせず、徐々に楽しめる流れにする',
    '- 子どもの集中力や体力を考え、長時間同じ活動を続けすぎない',
    '- 昼食前後に無理な移動や過密な予定を入れない',
    '- 休憩できる時間や余白を設ける',
    '- 帰宅直前に疲れすぎる活動を置かない',
    '- 最も満足度の高い体験を、体力が残っている時間帯に置く',
    '- 小さな子どもがいる場合は、予定変更しやすい構成にする',
    '',
    '### 時刻形式',
    '- departure と return は単一時刻（HH:mm）。例: "10:00"',
    '- spot / meal の滞在イベントは必ず時間帯。例: "11:00〜13:00"',
    '- 時間帯の区切りは全角の「〜」を使う',
    '- spotの到着イベントだけは例外として単一時刻でもよい',
    '',
    '### typeの使い分け',
    '- 移動開始は departure',
    '- 施設到着・滞在は spot',
    '- 食事は meal',
    '- 自宅到着のみ return（帰路開始を return にしない）',
    '',
    '### 必須構成（基本順）',
    '1. 自宅を出発: departure（単一時刻）',
    '2. 最初の施設へ到着: spot（単一時刻）',
    '3. 施設での滞在: spot（時間帯）',
    '4. 昼食: meal（時間帯）',
    '5. 必要に応じて別の体験: spot（時間帯）※プラン2では省略や短縮も可。プラン3では任意・短縮可能を明示可',
    '6. 現地を出発: departure（単一時刻）',
    '7. 自宅へ到着: return（単一時刻）',
    '',
    '- return は必ず1件だけ、かつ最後の項目にする',
    `- 最後の return 時刻は帰着時刻（${envelope.endTime}）を超えない`,
    '- 帰路開始の departure を必ず含める（returnの直前）',
    '',
    '### 良い出力例',
    '[',
    '  { "time": "10:00", "title": "自宅を出発", "description": "車で目的地へ向かいます（移動時間は概算）。", "type": "departure" },',
    '  { "time": "11:00", "title": "施設に到着", "description": "入場手続きを行います。", "type": "spot" },',
    '  { "time": "11:00〜12:30", "title": "中心体験", "description": "家族で発見を共有します。", "type": "spot" },',
    '  { "time": "12:30〜13:30", "title": "昼食と休憩", "description": "好みとアレルギーに配慮した食事候補（対応可否は施設確認）。", "type": "meal" },',
    '  { "time": "13:30〜14:30", "title": "体力に余裕があれば追加展示", "description": "疲れた場合は休憩または早めの帰宅へ変更できます。", "type": "spot" },',
    '  { "time": "14:30", "title": "施設を出発", "description": "自宅へ向かいます。", "type": "departure" },',
    '  { "time": "15:30", "title": "自宅へ到着", "description": "帰宅します。", "type": "return" }',
    ']',
    '',
    '## 回答ルール',
    '- JSON以外の文章を返さない',
    '- Markdownのコードブロック（```）を付けない',
    '- 項目名を変更しない',
    '- 項目を省略しない',
    ...(mode === 'strict'
      ? [
          '- plansは必ず3件（休日体験として差別化する）',
          '- 各planにtimelineを必ず含める',
          '- roundTripTime と localEnjoymentTime は出力しない',
          '- timelineのtypeは departure / spot / meal / return のいずれか',
          '- withinBudgetはbooleanとする',
          '- costは概算表現にする',
          '- title / reason は「家族最適化と title / reason」に従う',
          '- プラン2・プラン3はタイムライン上の必須特徴（各最低2つ）を満たす',
          '- 日本語で回答する',
        ]
      : mode === 'budget_relaxed'
        ? [
            '- plansは必ず1件（budget_relaxedの代表プラン）',
            '- 各planにtimelineを必ず含める',
            '- roundTripTime と localEnjoymentTime は出力しない',
            '- timelineのtypeは departure / spot / meal / return のいずれか',
            '- withinBudgetはbooleanとする',
            '- costは概算表現にする',
            '- title / reason は「家族最適化と title / reason」および「条件緩和（budget_relaxed）代表プラン」に従う',
            '- 日本語で回答する',
          ]
        : [
            '- plansは必ず1件（time_relaxedの代表プラン）',
            '- 各planにtimelineを必ず含める',
            '- roundTripTime と localEnjoymentTime は出力しない',
            '- timelineのtypeは departure / spot / meal / return のいずれか',
            '- withinBudgetはbooleanとする',
            '- costは概算表現にする',
            '- title / reason は「家族最適化と title / reason」および「条件緩和（time_relaxed）代表プラン」に従う',
            '- 日本語で回答する',
          ]),
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

async function fetchOpenAiJsonDraft(
  prompt: string,
  schema: Record<string, unknown>,
  schemaName: string
): Promise<unknown> {
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
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error('OpenAI recommendation refused');
  }

  const content = message?.content;
  if (!content) {
    throw new Error('Empty OpenAI content');
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (parseError) {
    throw new Error(
      parseError instanceof Error
        ? `JSON parse failed: ${parseError.message}`
        : 'JSON parse failed'
    );
  }
}

async function generateRelaxedPlanEntry(
  scenarioId: RelaxedScenarioId,
  strictEnvelope: ConstraintEnvelope,
  conditions: OutingConditions,
  participants: FamilyMemberProfile[],
  enrichment: RecommendationEnrichment,
  candidateSpots: SpotCandidate[]
): Promise<RelaxedPlanEntry> {
  const envelope = buildConstraintEnvelope(scenarioId, conditions);

  console.log(`Recommendation scenario: ${scenarioId}`);
  console.log('Constraint envelope:');
  console.log(`- budgetMax: ${envelope.budgetMax}`);
  console.log(`- startTime: ${envelope.startTime}`);
  console.log(`- endTime: ${envelope.endTime}`);

  if (envelope.relaxationHint == null) {
    throw new RelaxedPlanPipelineError(
      'OpenAI',
      `${scenarioId} envelope is missing relaxationHint`
    );
  }

  const prompt = buildRecommendationPrompt(
    envelope,
    conditions,
    participants,
    enrichment,
    candidateSpots,
    { mode: scenarioId, strictEnvelope }
  );

  const parsed = await fetchOpenAiJsonDraft(
    prompt,
    aiRelaxedRecommendationDraftSchema,
    'family_outing_relaxed_recommendation_draft'
  ).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'OpenAI request failed';
    const stage = message.startsWith('JSON parse failed') ? 'parse' : 'OpenAI';
    throw new RelaxedPlanPipelineError(stage, message);
  });

  try {
    validateAiRelaxedRecommendationDraft(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Draft validation failed';
    throw new RelaxedPlanPipelineError('Draft Validation', message);
  }

  const relaxedDraft = parsed as AiRelaxedRecommendationDraft;
  const plan = enrichSinglePlanDraft(relaxedDraft.plans[0]);

  try {
    validatePlan(plan);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Final validation failed';
    throw new RelaxedPlanPipelineError('Final Validation', message);
  }

  try {
    validateRecommendationBusinessRules({ plans: [plan] }, envelope);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Business validation failed';
    throw new RelaxedPlanPipelineError('Business Validation', message);
  }

  try {
    validateRelaxedPlanSemanticConsistency(plan, {
      scenarioId,
      strictEnvelope,
      relaxedEnvelope: envelope,
    });
  } catch (error) {
    if (error instanceof RelaxedPlanPipelineError) {
      throw error;
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Semantic consistency validation failed';
    throw new RelaxedPlanPipelineError('Semantic Consistency', message);
  }

  if (scenarioId === 'time_relaxed') {
    logTimeRelaxationUsage(
      plan,
      strictEnvelope.startTime,
      strictEnvelope.endTime
    );
  }

  return {
    scenarioId,
    relaxationHint: envelope.relaxationHint,
    plan,
  };
}

async function generateRelaxedPlans(
  strictEnvelope: ConstraintEnvelope,
  conditions: OutingConditions,
  participants: FamilyMemberProfile[],
  enrichment: RecommendationEnrichment,
  candidateSpots: SpotCandidate[]
): Promise<RelaxedPlanEntry[]> {
  const relaxedPlans: RelaxedPlanEntry[] = [];

  try {
    relaxedPlans.push(
      await generateRelaxedPlanEntry(
        'budget_relaxed',
        strictEnvelope,
        conditions,
        participants,
        enrichment,
        candidateSpots
      )
    );
    console.log('Budget relaxed business validation passed');
  } catch (error) {
    logRelaxedPlanFailure('budget_relaxed', error);
  }

  try {
    relaxedPlans.push(
      await generateRelaxedPlanEntry(
        'time_relaxed',
        strictEnvelope,
        conditions,
        participants,
        enrichment,
        candidateSpots
      )
    );
    console.log('Time relaxed business validation passed');
  } catch (error) {
    logRelaxedPlanFailure('time_relaxed', error);
  }

  return relaxedPlans;
}

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

  let strictEnvelope: ConstraintEnvelope;
  try {
    strictEnvelope = buildConstraintEnvelope('strict', conditions);
  } catch (error) {
    console.error('Constraint envelope build failed', error);
    res.status(400).json({ error: 'おでかけ条件の形式が不正です' });
    return;
  }

  console.log('=== /api/recommendations ===');
  console.log('Recommendation scenario: strict');
  console.log('Constraint envelope:');
  console.log(`- budgetMax: ${strictEnvelope.budgetMax}`);
  console.log(`- startTime: ${strictEnvelope.startTime}`);
  console.log(`- endTime: ${strictEnvelope.endTime}`);

  const candidateSpots = spotService.loadSampleSpots();
  console.log(`Loaded spots: ${candidateSpots.length}`);

  const prompt = buildRecommendationPrompt(
    strictEnvelope,
    conditions,
    participants,
    {
      weather: body.weather,
      traffic: body.traffic,
      congestion: body.congestion,
      reviews: body.reviews,
      businessHours: body.businessHours,
      parking: body.parking,
      priceLevel: body.priceLevel,
      specialEvents: body.specialEvents,
    },
    candidateSpots
  );
  console.log('=== recommendation prompt ===');
  console.log(prompt);

  if (!openAiApiKey || openAiApiKey.trim() === '') {
    console.error('OpenAI recommendation failed', new Error('OPENAI_API_KEY is missing'));
    res.status(500).json({ error: 'プランの取得に失敗しました' });
    return;
  }

  let parsed: unknown;

  try {
    parsed = await fetchOpenAiJsonDraft(
      prompt,
      aiRecommendationDraftSchema,
      'family_outing_recommendation_draft'
    );
  } catch (error) {
    console.error('OpenAI recommendation failed', error);
    res.status(500).json({ error: 'プランの取得に失敗しました' });
    return;
  }

  console.log('AI recommendation draft validation started');
  try {
    validateAiRecommendationDraft(parsed);
    console.log('AI recommendation draft validation passed');
  } catch (error) {
    console.error('AI recommendation draft validation failed', error);
    res.status(500).json({ error: 'AIの返却形式が不正です' });
    return;
  }

  let responseBody: RecommendationResponse;
  try {
    responseBody = enrichRecommendationWithCalculatedTimes(parsed);
  } catch (error) {
    console.error('Recommendation time enrichment failed:');
    console.error(error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'AIが生成したプランの内容に矛盾があります',
    });
    return;
  }

  console.log('Recommendation response validation started');
  try {
    validateRecommendationResponse(responseBody);
    console.log('Recommendation response validation passed');
  } catch (error) {
    console.error('Recommendation response validation failed', error);
    res.status(500).json({ error: 'AIの返却形式が不正です' });
    return;
  }

  console.log('Recommendation business validation started');
  try {
    validateRecommendationBusinessRules(responseBody, strictEnvelope);
    console.log('Recommendation business validation passed');
  } catch (error) {
    console.error('Recommendation business validation failed:');
    console.error(error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'AIが生成したプランの内容に矛盾があります',
    });
    return;
  }

  const relaxedPlans = await generateRelaxedPlans(
    strictEnvelope,
    conditions,
    participants,
    {
      weather: body.weather,
      traffic: body.traffic,
      congestion: body.congestion,
      reviews: body.reviews,
      businessHours: body.businessHours,
      parking: body.parking,
      priceLevel: body.priceLevel,
      specialEvents: body.specialEvents,
    },
    candidateSpots
  );

  inspectPlanSimilarity([
    ...responseBody.plans.map((plan, index) => ({
      label: `strict:${plan.id || `plan-${index + 1}`}`,
      plan,
    })),
    ...relaxedPlans.map((entry) => ({
      label: entry.scenarioId,
      plan: entry.plan,
    })),
  ]);

  const apiResponse: RecommendationResponse = {
    plans: responseBody.plans,
    relaxedPlans,
  };

  console.log('=== response JSON ===');
  console.log(JSON.stringify(apiResponse, null, 2));
  res.json(apiResponse);
});

app.listen(PORT, () => {
  console.log(`Family AI Concierge API listening on http://localhost:${PORT}`);
});
