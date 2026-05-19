import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import { matchAnalogs } from "./analogMatcher";
import { calculateConviction } from "./convictionEngine";
import { detectMarketBlindspot } from "./marketBlindspotDetector";
import { detectMarketPsychology } from "./marketPsychology";
import { detectPreBreakout } from "./preBreakoutDetector";
import { createSetupFingerprint } from "./setupFingerprint";

export function buildAnalogDiscoveryReport(report: IntelligenceReport) {
  return report.inputs
    .map((input) => {
      const fingerprint = createSetupFingerprint(input, "neutral");
      const analog = matchAnalogs(fingerprint);
      const preBreakout = detectPreBreakout(input);
      const psychology = detectMarketPsychology(input);
      const blindspot = detectMarketBlindspot(input);
      const conviction = calculateConviction(input, preBreakout, blindspot);

      return {
        ticker: input.ticker,
        fingerprint,
        analog,
        preBreakout,
        psychology,
        blindspot,
        conviction,
        explanation: `Detta case liknar tidigare runners eftersom ${analog.bestMatch.matchedTraits.join(
          ", "
        )}. ${blindspot.summary}`,
      };
    })
    .sort((a, b) => b.conviction.convictionScore - a.conviction.convictionScore);
}
