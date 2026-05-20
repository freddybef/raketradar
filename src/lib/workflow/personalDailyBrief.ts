import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import type { SignalDecayResult } from "@/lib/realtime/signalDecay";
import type { CrowdingSignal } from "@/lib/crowdingDetector";

export function generatePersonalDailyBrief(input: {
  report: IntelligenceReport;
  decay: SignalDecayResult[];
  crowding: CrowdingSignal[];
}) {
  const top = input.report.topRanked[0];
  const stealth = input.report.topRanked.find((stock) =>
    stock.tags.includes("insider accumulation")
  );
  const lostEdge = input.decay.find((item) => item.state !== "strengthening");
  const crowded = input.crowding.find((item) => item.crowdingScore >= 60);

  return {
    topConviction: top
      ? `${top.ticker}: ${top.totalScore}/100, ${top.reasons[0]}`
      : "Ingen toppkandidat",
    stealthSetups: stealth ? `${stealth.ticker}: stealth/insider-edge` : "Ingen tydlig stealth setup",
    changedOvernight: "Nya signaler prioriteras via pipeline snapshot och live feed.",
    lostEdge: lostEdge ? `${lostEdge.ticker}: ${lostEdge.reason}` : "Inget större tapp i edge.",
    marketIgnores: stealth
      ? `${stealth.ticker}: insider/edge före bred social uppmärksamhet.`
      : "Inget tydligt blindspot just nu.",
    becomingCrowded: crowded
      ? `${crowded.ticker}: ${crowded.evidence.join(", ")}`
      : "Ingen kraftig crowding flaggad.",
  };
}
