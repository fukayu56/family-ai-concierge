export type RetrievalScenarioId =
  | 'strict'
  | 'budget_relaxed'
  | 'time_relaxed';

export type RelaxationHint = {
  scenarioId: RetrievalScenarioId;
  label: string;
  changedFields: string[];
  before: Record<string, string>;
  after: Record<string, string>;
};

export type ConstraintEnvelope = {
  scenarioId: RetrievalScenarioId;
  budgetMax: number;
  startTime: string;
  endTime: string;
  transport: string;
  departurePlace: string;
  maxSpots: number;
  relaxationHint?: RelaxationHint;
};

/** Input conditions used to build a ConstraintEnvelope. */
export type OutingConditionsInput = {
  startTime: string;
  endTime: string;
  departurePlace: string;
  budget: string;
  transport: string;
  specialRequests?: string;
};
