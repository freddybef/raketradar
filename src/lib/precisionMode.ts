import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { AsymmetricSetup } from "@/lib/intelligence/history/asymmetricDetector";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import type { TimingResult } from "@/lib/realtime/timingEngine";
import type { CrowdingSignal } from "./crowdingDetector";

export type PrecisionMode = "ALL" | "HIGH_CONVICTION" | "EARLY_ONLY" | "STEALTH_ONLY";

export interface PrecisionCandidate {
  stock: RankedStock;
  asymmetry: AsymmetricSetup | null;
  timing: TimingResult | null;
  feedItems: SignalFeedItem[];
  crowding: CrowdingSignal | null;
}

export interface PrecisionResult {
  survivors: RankedStock[];
  filteredOut: Array<{ ticker: string; reason: string }>;
}

function hasConfluence(candidate: PrecisionCandidate) {
  const tags = new Set(candidate.stock.tags);
  const feedTypes = new Set(candidate.feedItems.map((item) => item.type));

  return (
    tags.has("insider accumulation") ||
    (feedTypes.has("social") && feedTypes.has("squeeze")) ||
    (feedTypes.has("volume") && feedTypes.has("narrative")) ||
    candidate.feedItems.some((item) => item.tags.includes("confluence"))
  );
}

export function applyPrecisionMode(
  candidates: PrecisionCandidate[],
  mode: PrecisionMode
): PrecisionResult {
  const filteredOut: PrecisionResult["filteredOut"] = [];
  const survivors = candidates.filter((candidate) => {
    const crowdingPenalty = candidate.crowding?.crowdingScore ?? 0;
    const asymmetryScore = candidate.asymmetry?.score ?? 0;
    const timingPhase = candidate.timing?.phase;
    const confluence = hasConfluence(candidate);

    if (crowdingPenalty >= 72) {
      filteredOut.push({ ticker: candidate.stock.ticker, reason: "Crowding för hög" });
      return false;
    }

    if (mode === "ALL") return true;

    if (mode === "HIGH_CONVICTION") {
      const pass =
        candidate.stock.totalScore >= 74 &&
        candidate.stock.conviction >= 68 &&
        asymmetryScore >= 60 &&
        confluence;
      if (!pass) {
        filteredOut.push({ ticker: candidate.stock.ticker, reason: "Saknar hög conviction + confluence" });
      }
      return pass;
    }

    if (mode === "EARLY_ONLY") {
      const pass =
        timingPhase === "early" ||
        (asymmetryScore >= 70 && !candidate.stock.tags.includes("social heat"));
      if (!pass) {
        filteredOut.push({ ticker: candidate.stock.ticker, reason: "Inte tillräckligt tidig" });
      }
      return pass;
    }

    const pass =
      candidate.stock.tags.includes("insider accumulation") ||
      candidate.stock.reasons.some((reason) => reason.toLowerCase().includes("insider"));
    if (!pass) {
      filteredOut.push({ ticker: candidate.stock.ticker, reason: "Ingen stealth/insider-edge" });
    }
    return pass;
  });

  return { survivors: survivors.map((candidate) => candidate.stock), filteredOut };
}
