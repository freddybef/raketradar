import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";

export interface SetupFingerprint {
  ticker: string;
  insiderPattern: "none" | "single_buy" | "cluster_buying" | "sell_pressure";
  socialVelocity: "silent" | "warming" | "accelerating" | "overheated";
  floatCharacteristics: "tight" | "normal" | "heavy";
  narrativeType: string;
  volatilityExpansion: "compressing" | "expanding" | "explosive";
  volumeStructure: "dry" | "rising_under_surface" | "breakout_volume";
  marketRegime: "risk_on" | "neutral" | "risk_off";
  accumulationPattern: "none" | "stealth" | "visible" | "distribution";
}

export function createSetupFingerprint(
  input: RankingInput,
  marketRegime: SetupFingerprint["marketRegime"] = "neutral"
): SetupFingerprint {
  const socialVelocity =
    input.social.velocityScore >= 88
      ? "overheated"
      : input.social.velocityScore >= 68
        ? "accelerating"
        : input.social.velocityScore >= 38
          ? "warming"
          : "silent";
  const floatCharacteristics =
    input.marketCapSek && input.marketCapSek < 750000000
      ? "tight"
      : input.marketCapSek && input.marketCapSek > 5000000000
        ? "heavy"
        : "normal";
  const insiderPattern =
    input.insider.direction === "bearish"
      ? "sell_pressure"
      : input.insider.buyValueSek > 600000
        ? "cluster_buying"
        : input.insider.buyValueSek > 0
          ? "single_buy"
          : "none";
  const volatilityExpansion =
    input.squeeze.score >= 82
      ? "explosive"
      : input.squeeze.score >= 58
        ? "expanding"
        : "compressing";
  const volumeStructure =
    input.unusualVolume >= 82
      ? "breakout_volume"
      : input.unusualVolume >= 58
        ? "rising_under_surface"
        : "dry";
  const accumulationPattern =
    insiderPattern === "sell_pressure"
      ? "distribution"
      : insiderPattern === "cluster_buying" && socialVelocity !== "overheated"
        ? "stealth"
        : insiderPattern === "cluster_buying"
          ? "visible"
          : "none";

  return {
    ticker: input.ticker,
    insiderPattern,
    socialVelocity,
    floatCharacteristics,
    narrativeType: input.narrative.primaryNarrative,
    volatilityExpansion,
    volumeStructure,
    marketRegime,
    accumulationPattern,
  };
}
