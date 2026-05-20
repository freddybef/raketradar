import { getMarketSessionStatus } from "@/lib/scheduler";

export type IngestLane = "FAST" | "MEDIUM" | "SLOW";

export interface IngestTask {
  lane: IngestLane;
  name: string;
  reason: string;
  shouldRun: boolean;
}

export function buildIngestSchedule(now = new Date()): IngestTask[] {
  const session = getMarketSessionStatus(now);
  const marketActive = session.phase === "opening" || session.phase === "intraday";

  return [
    {
      lane: "FAST",
      name: "realtime signals / insider spikes / conviction jumps",
      reason: "Behöver lägst latency och ska kunna streamas direkt.",
      shouldRun: marketActive,
    },
    {
      lane: "MEDIUM",
      name: "social aggregation / PM acceleration",
      reason: "Kan köras var 5-15 minut utan att tappa edge.",
      shouldRun: session.isTradingDay,
    },
    {
      lane: "SLOW",
      name: "AI reasoning / analog comparisons / historical analytics",
      reason: "Körs när snabb lane är sparad eller efter stängning.",
      shouldRun: session.phase === "pre_open" || session.phase === "after_close",
    },
  ];
}
