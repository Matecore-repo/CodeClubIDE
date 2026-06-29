import { modelCost } from "./pricing";

export interface UsageRecord {
  timestamp: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  savings?: number; // Estimated savings from incremental diffs
}

export interface MetricsSummary {
  totalCost: number;
  totalTokens: number;
  totalSavings: number;
  records: UsageRecord[];
}

export async function trackUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
  savingsTokens: number = 0,
  observation?: { estimatedCostUsd?: number; latencyMs?: number; timeToFirstTokenMs?: number },
) {
  const costInfo =
    observation?.estimatedCostUsd === undefined
      ? modelCost(model, promptTokens, completionTokens)
      : null;
  const cost = observation?.estimatedCostUsd ?? costInfo?.total ?? 0;

  // Calculate savings cost based on prompt price
  const _savingsCost = 0; // For now just track tokens, cost savings are complex

  const record: UsageRecord = {
    timestamp: Date.now(),
    model,
    promptTokens,
    completionTokens,
    cost,
    latencyMs: observation?.latencyMs,
    timeToFirstTokenMs: observation?.timeToFirstTokenMs,
    savings: savingsTokens,
  };

  const stored = await window.api.storeGet("metrics", "summary");
  const current: MetricsSummary =
    stored && typeof stored === "object" && "totalCost" in stored
      ? (stored as MetricsSummary)
      : {
          totalCost: 0,
          totalTokens: 0,
          totalSavings: 0,
          records: [],
        };

  current.totalCost += cost;
  current.totalTokens += promptTokens + completionTokens;
  current.totalSavings += savingsTokens;
  current.records.push(record);

  // Keep last 1000 records to avoid bloat
  if (current.records.length > 1000) {
    current.records = current.records.slice(-1000);
  }

  await window.api.storeSet("metrics", "summary", current);
}

export async function getMetrics(): Promise<MetricsSummary> {
  const stored = await window.api.storeGet("metrics", "summary");
  return stored && typeof stored === "object" && "totalCost" in stored
    ? (stored as MetricsSummary)
    : {
        totalCost: 0,
        totalTokens: 0,
        totalSavings: 0,
        records: [],
      };
}
