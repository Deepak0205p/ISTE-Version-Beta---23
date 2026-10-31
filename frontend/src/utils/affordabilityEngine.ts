import { formatINR } from './currency';

export interface AffordabilityInput {
  purchaseAmount: number;
  currentBalance: number;
  expectedMonthlyIncome: number;
  committedOutflows: number; // EMIs, Rent, Subscriptions
  averageDailyVariableBurn: number; // Discretionary grocery, food, shopping
  minimumAverageBalanceRequirement: number; // e.g. ₹10,000 bank MAB
  daysUntilNextInflow: number;
}

export interface AffordabilityReceipt {
  purchaseAmount: number;
  currentBalance: number;
  confirmedExpectedIncome: number;
  committedOutflows: number;
  variableSpendBurn: number;
  safetyBuffer: number;
  safetyBufferFormula: string;
  projectedCashFloor: number;
  dailyTrajectory: Array<{ day: number; balance: number }>;
  p10ScenarioFloor: number;
  p50ScenarioFloor: number;
  p90ScenarioFloor: number;
  verdict: 'AFFORDABLE' | 'TIGHT' | 'NOT_AFFORDABLE';
  verdictColor: string;
  verdictSummary: string;
}

/**
 * 100% Deterministic Pure Math Affordability Calculation (Zero LLM Arithmetic)
 */
export function calculateAffordabilityReceipt(input: AffordabilityInput): AffordabilityReceipt {
  const {
    purchaseAmount,
    currentBalance,
    expectedMonthlyIncome,
    committedOutflows,
    averageDailyVariableBurn,
    minimumAverageBalanceRequirement,
    daysUntilNextInflow
  } = input;

  // Formula: Safety Buffer = max(MAB, 15 days burn, volatility cushion)
  const fifteenDaysBurn = averageDailyVariableBurn * 15;
  const volatilityCushion = committedOutflows * 0.15;
  const safetyBuffer = Math.max(
    minimumAverageBalanceRequirement,
    fifteenDaysBurn,
    volatilityCushion
  );
  const safetyBufferFormula = `max(MAB ₹${minimumAverageBalanceRequirement}, 15-Day Burn ₹${Math.round(fifteenDaysBurn)}, Volatility Cushion ₹${Math.round(volatilityCushion)})`;

  // Daily Cash Floor Simulation over 30 days
  const dailyTrajectory: Array<{ day: number; balance: number }> = [];
  let simBalance = currentBalance - purchaseAmount;
  let minDailyBalance = simBalance;

  for (let day = 1; day <= 30; day++) {
    // Incur daily variable spend
    simBalance -= averageDailyVariableBurn;

    // Incur scheduled committed outflows around day 5 & 10
    if (day === 5) simBalance -= committedOutflows * 0.5; // rent/bills
    if (day === 10) simBalance -= committedOutflows * 0.5; // EMI

    // Add expected salary inflow on salary day
    if (day === daysUntilNextInflow) {
      simBalance += expectedMonthlyIncome;
    }

    if (simBalance < minDailyBalance) {
      minDailyBalance = simBalance;
    }

    dailyTrajectory.push({ day, balance: Math.round(simBalance) });
  }

  const projectedCashFloor = minDailyBalance;

  // Uncertainty scenarios (P10 conservative, P50 base, P90 optimistic)
  const p10ScenarioFloor = Math.round(projectedCashFloor - (averageDailyVariableBurn * 8) - (expectedMonthlyIncome * 0.05));
  const p50ScenarioFloor = Math.round(projectedCashFloor);
  const p90ScenarioFloor = Math.round(projectedCashFloor + (expectedMonthlyIncome * 0.05));

  // Determine Verdict
  let verdict: AffordabilityReceipt['verdict'] = 'AFFORDABLE';
  let verdictColor = '#22C55E';
  let verdictSummary = `Safe to proceed. Your minimum cash floor remains at ${formatINR(projectedCashFloor)}, comfortably above your ${formatINR(safetyBuffer)} safety threshold.`;

  if (projectedCashFloor < minimumAverageBalanceRequirement) {
    verdict = 'NOT_AFFORDABLE';
    verdictColor = '#EF4444';
    verdictSummary = `Purchase triggers an overdraft risk. Your daily cash trajectory dips to ${formatINR(projectedCashFloor)} before your next income arrives.`;
  } else if (projectedCashFloor < safetyBuffer) {
    verdict = 'TIGHT';
    verdictColor = '#F59E0B';
    verdictSummary = `Caution advised. Cash floor drops to ${formatINR(projectedCashFloor)}, which erodes your safety buffer (${formatINR(safetyBuffer)}) although above MAB.`;
  }

  return {
    purchaseAmount,
    currentBalance,
    confirmedExpectedIncome: expectedMonthlyIncome,
    committedOutflows,
    variableSpendBurn: averageDailyVariableBurn * 30,
    safetyBuffer,
    safetyBufferFormula,
    projectedCashFloor,
    dailyTrajectory,
    p10ScenarioFloor,
    p50ScenarioFloor,
    p90ScenarioFloor,
    verdict,
    verdictColor,
    verdictSummary
  };
}

