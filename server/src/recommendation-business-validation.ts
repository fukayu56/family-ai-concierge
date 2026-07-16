import type { ConstraintEnvelope } from './constraints/types';
import type {
  Plan,
  RecommendationResponse,
  TimelineItem,
} from './recommendation-response';

/** @deprecated Prefer ConstraintEnvelope. Kept for backward-compatible call sites. */
export type OutingBusinessConditions = {
  budget: string;
  endTime: string;
};

const DURATION_TOLERANCE_MINUTES = 10;

type InstantTime = { kind: 'instant'; minutes: number };
type RangeTime = { kind: 'range'; start: number; end: number };
type ParsedTimelineTime = InstantTime | RangeTime;

/**
 * Extract a yen amount from strings like "12000円" or "12,000円".
 * Returns null when no numeric amount can be found.
 */
export function parseYenAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/円/g, '').trim();
  const match = cleaned.match(/\d+/);
  if (!match) {
    return null;
  }

  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Parse HH:mm into minutes from midnight.
 * Fails when format is invalid or hour/minute are out of range.
 */
export function parseHhMm(raw: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Parse a timeline time as either HH:mm or HH:mm〜HH:mm / HH:mm-HH:mm.
 * Fails when the end of a range is earlier than the start.
 */
export function parseTimelineTime(raw: string): ParsedTimelineTime | null {
  const trimmed = raw.trim();
  const rangeParts = trimmed.split(/\s*[〜\-]\s*/);

  if (rangeParts.length === 2) {
    const start = parseHhMm(rangeParts[0] ?? '');
    const end = parseHhMm(rangeParts[1] ?? '');
    if (start == null || end == null) {
      return null;
    }
    if (end < start) {
      return null;
    }
    return { kind: 'range', start, end };
  }

  if (rangeParts.length === 1) {
    const minutes = parseHhMm(trimmed);
    if (minutes == null) {
      return null;
    }
    return { kind: 'instant', minutes };
  }

  return null;
}

/**
 * Parse Japanese duration labels into total minutes.
 * Supports forms like "2時間", "1時間30分", "90分", "約3時間", "1時間30分程度".
 */
export function parseDurationMinutes(raw: string): number | null {
  const text = raw.trim();
  const hoursMatch = text.match(/(\d+)\s*時間/);
  const minutesMatch = text.match(/(\d+)\s*分/);

  if (!hoursMatch && !minutesMatch) {
    return null;
  }

  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function isWithinTolerance(
  expectedMinutes: number,
  receivedMinutes: number
): boolean {
  return (
    Math.abs(expectedMinutes - receivedMinutes) <= DURATION_TOLERANCE_MINUTES
  );
}

function mergeIntervals(
  intervals: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [
    { start: sorted[0].start, end: sorted[0].end },
  ];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged;
}

function sumMergedIntervalMinutes(
  intervals: Array<{ start: number; end: number }>
): number {
  return mergeIntervals(intervals).reduce(
    (total, interval) => total + (interval.end - interval.start),
    0
  );
}

/**
 * Format total minutes into Japanese duration labels used by the API response.
 * 0 or negative minutes are treated as invalid.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    throw new Error('duration must be greater than 0 minutes');
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}分`;
  }
  if (minutes === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${minutes}分`;
}

export function calculateRoundTripMinutesFromTimeline(
  timeline: TimelineItem[]
): { minutes: number } | { error: string } {
  let firstDepartureIndex = -1;
  let outboundDeparture: number | null = null;

  for (let i = 0; i < timeline.length; i += 1) {
    const item = timeline[i];
    if (item.type !== 'departure') {
      continue;
    }
    const parsed = parseTimelineTime(item.time);
    if (parsed?.kind === 'instant') {
      firstDepartureIndex = i;
      outboundDeparture = parsed.minutes;
      break;
    }
  }

  if (outboundDeparture == null || firstDepartureIndex < 0) {
    return { error: 'outbound departure time is missing or invalid' };
  }

  let outboundArrival: number | null = null;
  for (let i = firstDepartureIndex + 1; i < timeline.length; i += 1) {
    const item = timeline[i];
    if (item.type !== 'spot') {
      continue;
    }
    const parsed = parseTimelineTime(item.time);
    if (parsed?.kind === 'instant') {
      outboundArrival = parsed.minutes;
      break;
    }
  }

  if (outboundArrival == null) {
    return { error: 'outbound arrival time is missing or invalid' };
  }
  if (outboundArrival < outboundDeparture) {
    return { error: 'outbound arrival is earlier than departure' };
  }

  let lastReturnIndex = -1;
  let returnHome: number | null = null;
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const item = timeline[i];
    if (item.type !== 'return') {
      continue;
    }
    const parsed = parseTimelineTime(item.time);
    if (parsed?.kind === 'instant') {
      lastReturnIndex = i;
      returnHome = parsed.minutes;
      break;
    }
  }

  if (returnHome == null || lastReturnIndex < 0) {
    return { error: 'return time is missing or invalid' };
  }

  let inboundDeparture: number | null = null;
  for (let i = lastReturnIndex - 1; i >= 0; i -= 1) {
    const item = timeline[i];
    if (item.type !== 'departure') {
      continue;
    }
    const parsed = parseTimelineTime(item.time);
    if (parsed?.kind === 'instant') {
      inboundDeparture = parsed.minutes;
      break;
    }
  }

  if (inboundDeparture == null) {
    return { error: 'return departure time is missing or invalid' };
  }
  if (returnHome < inboundDeparture) {
    return { error: 'return home is earlier than return departure' };
  }

  const outboundMinutes = outboundArrival - outboundDeparture;
  const inboundMinutes = returnHome - inboundDeparture;
  return { minutes: outboundMinutes + inboundMinutes };
}

export function calculateLocalEnjoymentMinutesFromTimeline(
  timeline: TimelineItem[]
): { minutes: number } | { error: string } {
  const intervals: Array<{ start: number; end: number }> = [];

  for (const item of timeline) {
    if (item.type !== 'spot' && item.type !== 'meal') {
      continue;
    }

    const parsed = parseTimelineTime(item.time);
    if (parsed == null) {
      return { error: 'spot/meal time is missing or invalid' };
    }
    if (parsed.kind !== 'range') {
      // Arrival-style single timestamps are excluded from enjoyment time.
      continue;
    }

    intervals.push({ start: parsed.start, end: parsed.end });
  }

  return { minutes: sumMergedIntervalMinutes(intervals) };
}

/**
 * Temporary debug logging for investigating business-validation mismatches.
 * Does not change validation outcomes.
 */
function logPlanBusinessValidationDebug(plan: Plan): void {
  const parsedRoundTrip = parseDurationMinutes(plan.roundTripTime);
  const parsedLocalEnjoyment = parseDurationMinutes(plan.localEnjoymentTime);
  const computedRoundTrip = calculateRoundTripMinutesFromTimeline(plan.timeline);
  const computedLocalEnjoyment = calculateLocalEnjoymentMinutesFromTimeline(
    plan.timeline
  );

  console.log('----- Business validation debug -----');
  console.log('plan.id:', plan.id);
  console.log('roundTripTime(文字列):', plan.roundTripTime);
  console.log('roundTripTime(解析後の分):', parsedRoundTrip);
  console.log('localEnjoymentTime(文字列):', plan.localEnjoymentTime);
  console.log('localEnjoymentTime(解析後の分):', parsedLocalEnjoyment);
  console.log('timeline全件:', JSON.stringify(plan.timeline, null, 2));

  plan.timeline.forEach((item, index) => {
    const parsed = parseTimelineTime(item.time);
    const kindLabel =
      parsed == null
        ? '解析不可'
        : parsed.kind === 'instant'
          ? '単一時刻'
          : '時間帯';
    const startMinutes =
      parsed == null
        ? null
        : parsed.kind === 'instant'
          ? parsed.minutes
          : parsed.start;
    const endMinutes =
      parsed == null
        ? null
        : parsed.kind === 'instant'
          ? parsed.minutes
          : parsed.end;

    console.log(`timeline[${index}]`);
    console.log('  time:', item.time);
    console.log('  type:', item.type);
    console.log('  開始分:', startMinutes);
    console.log('  終了分:', endMinutes);
    console.log('  単一時刻か時間帯か:', kindLabel);
  });

  console.log(
    'computedRoundTripMinutes:',
    'minutes' in computedRoundTrip
      ? computedRoundTrip.minutes
      : computedRoundTrip.error
  );
  console.log(
    'computedLocalEnjoymentMinutes:',
    'minutes' in computedLocalEnjoyment
      ? computedLocalEnjoyment.minutes
      : computedLocalEnjoyment.error
  );
  console.log('-------------------------------------');
}

function validatePlanRoundTripTime(plan: Plan, failures: string[]): void {
  const calculated = calculateRoundTripMinutesFromTimeline(plan.timeline);
  if ('error' in calculated) {
    failures.push(`${plan.id}: ${calculated.error}`);
    return;
  }

  const received = parseDurationMinutes(plan.roundTripTime);
  if (received == null) {
    failures.push(`${plan.id}: roundTripTime is not parseable`);
    return;
  }

  if (!isWithinTolerance(calculated.minutes, received)) {
    failures.push(
      [
        `${plan.id}: roundTripTime is inconsistent`,
        `expected ${calculated.minutes} minutes, received ${received} minutes`,
      ].join('\n')
    );
  }
}

function validatePlanLocalEnjoymentTime(plan: Plan, failures: string[]): void {
  const calculated = calculateLocalEnjoymentMinutesFromTimeline(plan.timeline);
  if ('error' in calculated) {
    failures.push(`${plan.id}: ${calculated.error}`);
    return;
  }

  const received = parseDurationMinutes(plan.localEnjoymentTime);
  if (received == null) {
    failures.push(`${plan.id}: localEnjoymentTime is not parseable`);
    return;
  }

  if (!isWithinTolerance(calculated.minutes, received)) {
    failures.push(
      [
        `${plan.id}: localEnjoymentTime is inconsistent`,
        `expected ${calculated.minutes} minutes, received ${received} minutes`,
      ].join('\n')
    );
  }
}

/**
 * Business rules for recommendation plans:
 * 1. cost vs withinBudget consistency against budget
 * 2. last return time must not exceed endTime (HH:mm only)
 * 3. roundTripTime vs timeline travel durations (±10 minutes)
 * 4. localEnjoymentTime vs merged spot/meal ranges (±10 minutes)
 */
export function validateRecommendationBusinessRules(
  response: RecommendationResponse,
  envelope: ConstraintEnvelope
): void {
  const failures: string[] = [];
  const budget = envelope.budgetMax;
  const endTimeMinutes = parseHhMm(envelope.endTime);

  if (!Number.isFinite(budget) || budget < 0) {
    failures.push('envelope: budgetMax is invalid');
  }

  if (endTimeMinutes == null) {
    failures.push('envelope: endTime must be HH:mm');
  }

  for (const plan of response.plans) {
    logPlanBusinessValidationDebug(plan);

    const cost = parseYenAmount(plan.cost);
    if (cost == null) {
      failures.push(`${plan.id}: cost amount is not parseable`);
    } else if (budget != null) {
      const expectedWithinBudget = cost <= budget;
      if (plan.withinBudget !== expectedWithinBudget) {
        failures.push(`${plan.id}: cost and withinBudget are inconsistent`);
      }
    }

    const returnItems = plan.timeline.filter((item) => item.type === 'return');
    if (returnItems.length < 1) {
      failures.push(`${plan.id}: timeline must include at least one return`);
    } else {
      const lastReturn = returnItems[returnItems.length - 1];
      const returnMinutes = parseHhMm(lastReturn.time);
      if (returnMinutes == null) {
        failures.push(`${plan.id}: return time must be HH:mm`);
      } else if (endTimeMinutes != null && returnMinutes > endTimeMinutes) {
        failures.push(`${plan.id}: return time exceeds endTime`);
      }
    }

    validatePlanRoundTripTime(plan, failures);
    validatePlanLocalEnjoymentTime(plan, failures);
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}
