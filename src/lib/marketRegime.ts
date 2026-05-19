export interface MarketRegime {
  riskMode:
    | "risk_on"
    | "neutral"
    | "risk_off"
    | "squeeze_heavy"
    | "defensive"
    | "ai_speculation"
    | "biotech_gambling"
    | "low_liquidity_risk_off"
    | "retail_mania";
  smallCapAppetite: number;
  aiThemeExpansion: number;
  biotechSpeculation: number;
  squeezeEnvironment: number;
  rankingWeights: {
    social: number;
    insider: number;
    squeeze: number;
    narrative: number;
    momentum: number;
  };
}

export function detectMarketRegime(input?: Partial<MarketRegime>): MarketRegime {
  const smallCapAppetite = input?.smallCapAppetite ?? 64;
  const squeezeEnvironment = input?.squeezeEnvironment ?? 58;
  const aiThemeExpansion = input?.aiThemeExpansion ?? 62;
  const biotechSpeculation = input?.biotechSpeculation ?? 59;
  const riskMode: MarketRegime["riskMode"] =
    input?.riskMode ??
    (squeezeEnvironment >= 78
      ? "squeeze_heavy"
      : aiThemeExpansion >= 78
        ? "ai_speculation"
        : biotechSpeculation >= 78
          ? "biotech_gambling"
          : smallCapAppetite <= 28
            ? "low_liquidity_risk_off"
            : smallCapAppetite >= 84
              ? "retail_mania"
              : smallCapAppetite >= 70
      ? "risk_on"
      : smallCapAppetite <= 38
        ? "risk_off"
        : "neutral");

  return {
    riskMode,
    smallCapAppetite,
    aiThemeExpansion,
    biotechSpeculation,
    squeezeEnvironment,
    rankingWeights:
      riskMode === "squeeze_heavy"
        ? { social: 0.2, insider: 0.12, squeeze: 0.23, narrative: 0.13, momentum: 0.17 }
        : riskMode === "ai_speculation"
          ? { social: 0.18, insider: 0.13, squeeze: 0.14, narrative: 0.22, momentum: 0.15 }
          : riskMode === "biotech_gambling"
            ? { social: 0.12, insider: 0.13, squeeze: 0.12, narrative: 0.2, momentum: 0.13 }
            : riskMode === "low_liquidity_risk_off" || riskMode === "defensive"
              ? { social: 0.09, insider: 0.24, squeeze: 0.08, narrative: 0.11, momentum: 0.12 }
              : riskMode === "retail_mania"
                ? { social: 0.22, insider: 0.1, squeeze: 0.18, narrative: 0.16, momentum: 0.16 }
                : riskMode === "risk_on"
        ? { social: 0.2, insider: 0.14, squeeze: 0.18, narrative: 0.16, momentum: 0.16 }
        : riskMode === "risk_off"
          ? { social: 0.11, insider: 0.22, squeeze: 0.1, narrative: 0.12, momentum: 0.13 }
          : { social: 0.16, insider: 0.17, squeeze: 0.15, narrative: 0.14, momentum: 0.15 },
  };
}
