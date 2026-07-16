import { parseHhMm, parseYenAmount } from '../recommendation-business-validation';
import type {
  ConstraintEnvelope,
  OutingConditionsInput,
  RelaxationHint,
  RetrievalScenarioId,
} from './types';

const STRICT_MAX_SPOTS = 3;
const BUDGET_RELAX_RATE = 1.1;
const BUDGET_RELAX_MIN_YEN = 2000;
const TIME_RELAX_MINUTES = 30;
const EARLIEST_START_MINUTES = 6 * 60; // 06:00
const LATEST_END_MINUTES = 22 * 60; // 22:00

/**
 * Build a ConstraintEnvelope for the given scenario.
 * Throws when budget or time fields cannot be parsed (no silent defaults).
 */
export function buildConstraintEnvelope(
  scenarioId: RetrievalScenarioId,
  conditions: OutingConditionsInput
): ConstraintEnvelope {
  const budgetMax = parseBudgetOrThrow(conditions.budget);
  const startTime = parseTimeOrThrow(conditions.startTime, 'startTime');
  const endTime = parseTimeOrThrow(conditions.endTime, 'endTime');

  const base: ConstraintEnvelope = {
    scenarioId,
    budgetMax,
    startTime,
    endTime,
    transport: conditions.transport,
    departurePlace: conditions.departurePlace,
    maxSpots: STRICT_MAX_SPOTS,
  };

  switch (scenarioId) {
    case 'strict':
      return { ...base, relaxationHint: undefined };
    case 'budget_relaxed':
      return buildBudgetRelaxedEnvelope(base, budgetMax);
    case 'time_relaxed':
      return buildTimeRelaxedEnvelope(base, startTime, endTime);
    default: {
      const exhaustive: never = scenarioId;
      throw new Error(`Unsupported scenario: ${exhaustive}`);
    }
  }
}

function buildBudgetRelaxedEnvelope(
  base: ConstraintEnvelope,
  inputBudget: number
): ConstraintEnvelope {
  const relaxedBudgetMax = Math.round(
    Math.max(inputBudget * BUDGET_RELAX_RATE, inputBudget + BUDGET_RELAX_MIN_YEN)
  );
  const diff = relaxedBudgetMax - inputBudget;

  const relaxationHint: RelaxationHint = {
    scenarioId: 'budget_relaxed',
    label: `予算を${diff.toLocaleString('ja-JP')}円増やすと選択肢が広がります`,
    changedFields: ['budget'],
    before: { budget: `${inputBudget.toLocaleString('ja-JP')}円` },
    after: { budget: `${relaxedBudgetMax.toLocaleString('ja-JP')}円` },
  };

  return {
    ...base,
    scenarioId: 'budget_relaxed',
    budgetMax: relaxedBudgetMax,
    relaxationHint,
  };
}

function buildTimeRelaxedEnvelope(
  base: ConstraintEnvelope,
  inputStartTime: string,
  inputEndTime: string
): ConstraintEnvelope {
  const startMinutes = parseHhMm(inputStartTime);
  const endMinutes = parseHhMm(inputEndTime);
  if (startMinutes == null || endMinutes == null) {
    throw new Error('time_relaxed: startTime and endTime must be HH:mm');
  }

  const relaxedStartMinutes = Math.max(
    EARLIEST_START_MINUTES,
    startMinutes - TIME_RELAX_MINUTES
  );
  const relaxedEndMinutes = Math.min(
    LATEST_END_MINUTES,
    endMinutes + TIME_RELAX_MINUTES
  );

  const relaxedStartTime = formatHhMm(relaxedStartMinutes);
  const relaxedEndTime = formatHhMm(relaxedEndMinutes);

  const relaxationHint: RelaxationHint = {
    scenarioId: 'time_relaxed',
    label: '出発を30分早め、帰宅を30分遅くすると選択肢が広がります',
    changedFields: ['startTime', 'endTime'],
    before: { startTime: inputStartTime, endTime: inputEndTime },
    after: { startTime: relaxedStartTime, endTime: relaxedEndTime },
  };

  return {
    ...base,
    scenarioId: 'time_relaxed',
    startTime: relaxedStartTime,
    endTime: relaxedEndTime,
    relaxationHint,
  };
}

function parseBudgetOrThrow(budget: string): number {
  const amount = parseYenAmount(budget);
  if (amount == null) {
    throw new Error('conditions: budget amount is not parseable');
  }
  return amount;
}

function parseTimeOrThrow(raw: string, field: string): string {
  const minutes = parseHhMm(raw);
  if (minutes == null) {
    throw new Error(`conditions: ${field} must be HH:mm`);
  }
  return formatHhMm(minutes);
}

function formatHhMm(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
