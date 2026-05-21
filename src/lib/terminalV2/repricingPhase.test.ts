import { classifyRepricingPhase } from "@/lib/terminalV2/canonicalTradingSnapshot";

export function verifyRepricingPhaseClassification() {
  const largeMoveContinuation = classifyRepricingPhase({
    dayChangePct: 38,
    intradayMomentumPct: 18,
    rvol: 3.4,
    continuation: 82,
    risk: 48,
    isActiveToday: true,
    freshnessStatus: "activeToday",
    signalQuality: "ACTIVE_CONTINUATION",
    triggerVerificationState: "PRICE_ONLY",
    sourceBucket: "PARABOLIC_WATCH",
  });

  const fakeSqueezeExhaustion = classifyRepricingPhase({
    dayChangePct: 42,
    intradayMomentumPct: 24,
    rvol: 2.7,
    continuation: 38,
    risk: 84,
    isActiveToday: true,
    freshnessStatus: "activeToday",
    signalQuality: "STALLED",
    triggerVerificationState: "PRICE_ONLY",
    sourceBucket: "PARABOLIC_WATCH",
  });

  const lowRvolPriceMove = classifyRepricingPhase({
    dayChangePct: 9,
    intradayMomentumPct: 5,
    rvol: 1.08,
    continuation: 66,
    risk: 42,
    isActiveToday: true,
    freshnessStatus: "activeToday",
    signalQuality: "EARLY_WATCH",
    triggerVerificationState: "PRICE_ONLY",
    sourceBucket: "WATCH",
  });

  const dormantWakeup = classifyRepricingPhase({
    dayChangePct: 6,
    intradayMomentumPct: 3.6,
    rvol: 1.72,
    continuation: 61,
    risk: 44,
    isActiveToday: true,
    freshnessStatus: "activeToday",
    signalQuality: "EARLY_WATCH",
    triggerVerificationState: "UNVERIFIED",
    sourceBucket: "STEALTH",
    recentlyActive: false,
  });

  return {
    pass:
      largeMoveContinuation === "REPRICING" &&
      fakeSqueezeExhaustion === "EXHAUSTION" &&
      lowRvolPriceMove !== "REPRICING" &&
      lowRvolPriceMove !== "AWAKENING" &&
      dormantWakeup === "AWAKENING",
    largeMoveContinuation,
    fakeSqueezeExhaustion,
    lowRvolPriceMove,
    dormantWakeup,
  };
}
