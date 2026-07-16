import type { ConstraintEnvelope } from '../constraints/types';
import type { Plan } from '../recommendation-response';

export type RelaxedScenarioId = 'budget_relaxed' | 'time_relaxed';

export type RelaxedPipelineStage =
  | 'OpenAI'
  | 'parse'
  | 'Draft Validation'
  | 'Final Validation'
  | 'Business Validation'
  | 'Semantic Consistency';

export class RelaxedPlanPipelineError extends Error {
  readonly stage: RelaxedPipelineStage;

  constructor(stage: RelaxedPipelineStage, message: string) {
    super(message);
    this.name = 'RelaxedPlanPipelineError';
    this.stage = stage;
  }
}

export type RelaxedSemanticValidationContext = {
  scenarioId: RelaxedScenarioId;
  strictEnvelope: ConstraintEnvelope;
  relaxedEnvelope: ConstraintEnvelope;
};

function reasonIncludesYenAmount(reason: string, amount: number): boolean {
  const formatted = amount.toLocaleString('ja-JP');
  const candidates = [
    `${formatted}円`,
    formatted,
    `${amount}円`,
    String(amount),
  ];
  return candidates.some((candidate) => reason.includes(candidate));
}

/** Generic words excluded from semantic keyword comparison (no morphological analysis). */
const SEMANTIC_STOP_WORDS = new Set([
  'プラン',
  '楽しむ',
  '楽しめる',
  '家族',
  '通常',
  '帰宅',
  '出発',
  '緩和',
  '予算',
  '概算',
  '未確認',
  '追加',
  '可能',
  '広げる',
  '近づける',
  '場合',
  'ため',
  'こと',
  'この',
  'その',
  'ある',
  'する',
  'できる',
  'できます',
  'します',
  'など',
  'また',
  'および',
  '向け',
  '時間',
  '元',
  '約',
]);

function extractKeyPhrases(text: string): string[] {
  const stripped = text
    .replace(/\d{1,2}:\d{2}/g, ' ')
    .replace(/[\d,]+円/g, ' ')
    .replace(/[「」『』（）()【】]/g, ' ');

  return stripped
    .split(/[、。．・，,\s\-—〜~とややのでをにはがもへ]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .filter((part) => !SEMANTIC_STOP_WORDS.has(part));
}

function hasPhraseOverlap(phrases: string[], searchText: string): boolean {
  if (phrases.length === 0) {
    // No comparable keywords → do not warn (uncertain, not a hard failure).
    return true;
  }

  return phrases.some((phrase) => searchText.includes(phrase));
}

function warnIfFieldMismatch(
  scenarioId: RelaxedScenarioId,
  field: 'title' | 'reason',
  text: string,
  searchText: string
): void {
  const phrases = extractKeyPhrases(text).slice(0, 8);
  if (!hasPhraseOverlap(phrases, searchText)) {
    console.warn(
      `[Semantic Consistency Warning] ${scenarioId} ${field} keywords may not match spots/timeline: ${phrases.join(', ')}`
    );
  }
}

/**
 * Lightweight semantic consistency checks for relaxed plans.
 * Hard failures omit the plan; keyword mismatches emit developer warnings only.
 */
export function validateRelaxedPlanSemanticConsistency(
  plan: Plan,
  context: RelaxedSemanticValidationContext
): void {
  const failures: string[] = [];

  if (plan.title.trim() === '') {
    failures.push('title is empty');
  }
  if (plan.spots.trim() === '') {
    failures.push('spots is empty');
  }
  if (plan.reason.trim() === '') {
    failures.push('reason is empty');
  }

  const spotTimelineItems = plan.timeline.filter((item) => item.type === 'spot');
  if (spotTimelineItems.length < 1) {
    failures.push('timeline must include at least one spot type item');
  }

  if (context.scenarioId === 'time_relaxed') {
    const hint = context.relaxedEnvelope.relaxationHint;
    const beforeStart =
      hint?.before.startTime ?? context.strictEnvelope.startTime;
    const beforeEnd = hint?.before.endTime ?? context.strictEnvelope.endTime;
    const afterStart = hint?.after.startTime ?? context.relaxedEnvelope.startTime;
    const afterEnd = hint?.after.endTime ?? context.relaxedEnvelope.endTime;

    if (!plan.reason.includes(beforeStart)) {
      failures.push(`reason must include original start time (${beforeStart})`);
    }
    if (!plan.reason.includes(beforeEnd)) {
      failures.push(`reason must include original end time (${beforeEnd})`);
    }
    if (!plan.reason.includes(afterStart)) {
      failures.push(`reason must include relaxed start time (${afterStart})`);
    }
    if (!plan.reason.includes(afterEnd)) {
      failures.push(`reason must include relaxed end time (${afterEnd})`);
    }
  }

  if (context.scenarioId === 'budget_relaxed') {
    if (
      !reasonIncludesYenAmount(plan.reason, context.strictEnvelope.budgetMax)
    ) {
      failures.push(
        `reason must include original budget (${context.strictEnvelope.budgetMax.toLocaleString('ja-JP')}円)`
      );
    }
    if (
      !reasonIncludesYenAmount(plan.reason, context.relaxedEnvelope.budgetMax)
    ) {
      failures.push(
        `reason must include relaxed budget (${context.relaxedEnvelope.budgetMax.toLocaleString('ja-JP')}円)`
      );
    }
  }

  if (failures.length > 0) {
    throw new RelaxedPlanPipelineError(
      'Semantic Consistency',
      failures.join('; ')
    );
  }

  const timelineSearchText = plan.timeline
    .map((item) => `${item.title} ${item.description}`)
    .join(' ');
  const searchText = `${plan.spots} ${timelineSearchText}`;

  warnIfFieldMismatch(context.scenarioId, 'title', plan.title, searchText);
  warnIfFieldMismatch(context.scenarioId, 'reason', plan.reason, searchText);
}

export function classifyRelaxedPipelineError(
  error: unknown
): RelaxedPlanPipelineError {
  if (error instanceof RelaxedPlanPipelineError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : 'Unknown relaxed plan error';

  if (message.startsWith('JSON parse failed')) {
    return new RelaxedPlanPipelineError('parse', message);
  }

  if (
    message === 'Empty OpenAI content' ||
    message === 'OpenAI recommendation refused'
  ) {
    return new RelaxedPlanPipelineError('OpenAI', message);
  }

  return new RelaxedPlanPipelineError('OpenAI', message);
}

export function logRelaxedPlanFailure(
  scenarioId: RelaxedScenarioId,
  error: unknown
): void {
  const pipelineError = classifyRelaxedPipelineError(error);

  console.error(`${scenarioId} recommendation failed`);
  console.error(`- stage: ${pipelineError.stage}`);
  console.error(`- summary: ${pipelineError.message}`);
  console.error(`- omitted from relaxedPlans`);
}
