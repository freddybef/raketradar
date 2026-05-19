import { supabase } from "./supabase";
import type { Tables } from "./database.types";

export type StockSignal = Tables<"stock_signals">;

export type SignalFactorKey =
  | "unusualVolume"
  | "insiderScore"
  | "newsImpact"
  | "socialBuzz"
  | "floatLiquidity"
  | "momentum";

export type SignalFactor = {
  key: SignalFactorKey;
  label: string;
  score: number;
  weight: number;
  evidence: string;
};

export type AiSignalSummary = {
  bullish: string[];
  bearish: string[];
  risks: string[];
  triggers: string[];
  confidence: number;
};

export type RankedStockSignal = StockSignal & {
  raket_score: number;
  factors: SignalFactor[];
  why_moving: string[];
  ai_summary: AiSignalSummary;
};

export type SignalEngineInput = {
  signal: StockSignal;
  volumeRatio?: number;
  insiderActivityScore?: number;
  newsImpactScore?: number;
  socialBuzzScore?: number;
  floatSharesMillions?: number;
  turnoverMillionsSek?: number;
  momentumPercent?: number;
};

export const RAKET_SCORE_WEIGHTS: Record<SignalFactorKey, number> = {
  unusualVolume: 0.22,
  insiderScore: 0.16,
  newsImpact: 0.2,
  socialBuzz: 0.12,
  floatLiquidity: 0.14,
  momentum: 0.16,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function inferVolumeRatio(signal: StockSignal) {
  const text = `${signal.signal_type} ${signal.description} ${signal.ai_reason ?? ""}`.toLowerCase();
  if (text.includes("squeeze")) return 4.8;
  if (text.includes("volym") || text.includes("volume")) return 3.4;
  if (text.includes("momentum")) return 2.6;
  return Math.max(1.1, (signal.score / 100) * 2.8);
}

function scoreUnusualVolume(volumeRatio: number): SignalFactor {
  const score = clampScore((volumeRatio / 5) * 100);

  return {
    key: "unusualVolume",
    label: "Unusual volume",
    score,
    weight: RAKET_SCORE_WEIGHTS.unusualVolume,
    evidence: `${volumeRatio.toFixed(1)}x normal omsättning`,
  };
}

function scoreInsiderActivity(value: number): SignalFactor {
  return {
    key: "insiderScore",
    label: "Insider score",
    score: clampScore(value),
    weight: RAKET_SCORE_WEIGHTS.insiderScore,
    evidence:
      value >= 70
        ? "Insiderbilden stödjer caset"
        : value >= 45
          ? "Neutral insiderbild"
          : "Svagt eller saknat insiderstöd",
  };
}

function scoreNewsImpact(value: number): SignalFactor {
  return {
    key: "newsImpact",
    label: "PM/news impact",
    score: clampScore(value),
    weight: RAKET_SCORE_WEIGHTS.newsImpact,
    evidence:
      value >= 75
        ? "Nyhetsflödet pekar på möjlig omvärdering"
        : value >= 50
          ? "Nyheter stödjer bevakning"
          : "Begränsad nyhetskraft just nu",
  };
}

function scoreSocialBuzz(value: number): SignalFactor {
  return {
    key: "socialBuzz",
    label: "Social buzz",
    score: clampScore(value),
    weight: RAKET_SCORE_WEIGHTS.socialBuzz,
    evidence:
      value >= 70
        ? "Ökad diskussion i sociala kanaler"
        : value >= 45
          ? "Måttligt brus i kanaler"
          : "Lågt socialt momentum",
  };
}

function scoreFloatLiquidity(floatSharesMillions: number, turnoverMillionsSek: number): SignalFactor {
  const floatScore = floatSharesMillions <= 25 ? 85 : floatSharesMillions <= 80 ? 65 : 45;
  const liquidityScore =
    turnoverMillionsSek >= 8 ? 85 : turnoverMillionsSek >= 2 ? 65 : 35;
  const score = clampScore(floatScore * 0.55 + liquidityScore * 0.45);

  return {
    key: "floatLiquidity",
    label: "Float/liquidity",
    score,
    weight: RAKET_SCORE_WEIGHTS.floatLiquidity,
    evidence: `${floatSharesMillions.toFixed(0)}M float, ${turnoverMillionsSek.toFixed(1)} MSEK omsättning`,
  };
}

function scoreMomentum(momentumPercent: number): SignalFactor {
  const score = clampScore(50 + momentumPercent * 3.2);

  return {
    key: "momentum",
    label: "Momentum",
    score,
    weight: RAKET_SCORE_WEIGHTS.momentum,
    evidence: `${momentumPercent >= 0 ? "+" : ""}${momentumPercent.toFixed(1)}% kort momentum`,
  };
}

function inferFactorInputs(signal: StockSignal): Required<Omit<SignalEngineInput, "signal">> {
  const base = signal.score;
  const description = `${signal.signal_type} ${signal.description} ${signal.ai_reason ?? ""}`.toLowerCase();
  const newsBoost = description.includes("rapport") || description.includes("pm") ? 12 : 0;
  const socialBoost = description.includes("squeeze") || description.includes("microcap") ? 14 : 0;

  return {
    volumeRatio: inferVolumeRatio(signal),
    insiderActivityScore: clampScore(base - 8 + (description.includes("insider") ? 18 : 0)),
    newsImpactScore: clampScore(base + newsBoost),
    socialBuzzScore: clampScore(base - 12 + socialBoost),
    floatSharesMillions: description.includes("microcap") ? 18 : 55,
    turnoverMillionsSek: description.includes("illikvid") ? 1.2 : 6.5,
    momentumPercent: Math.max(-8, Math.min(14, (base - 62) / 3)),
  };
}

export function rankSignal(input: SignalEngineInput): RankedStockSignal {
  const inferred = inferFactorInputs(input.signal);
  const factors = [
    scoreUnusualVolume(input.volumeRatio ?? inferred.volumeRatio),
    scoreInsiderActivity(input.insiderActivityScore ?? inferred.insiderActivityScore),
    scoreNewsImpact(input.newsImpactScore ?? inferred.newsImpactScore),
    scoreSocialBuzz(input.socialBuzzScore ?? inferred.socialBuzzScore),
    scoreFloatLiquidity(
      input.floatSharesMillions ?? inferred.floatSharesMillions,
      input.turnoverMillionsSek ?? inferred.turnoverMillionsSek
    ),
    scoreMomentum(input.momentumPercent ?? inferred.momentumPercent),
  ];

  const raketScore = clampScore(
    factors.reduce((total, factor) => total + factor.score * factor.weight, 0)
  );
  const strongestFactors = [...factors].sort((a, b) => b.score - a.score).slice(0, 3);
  const risks = factors.filter((factor) => factor.score < 50);

  return {
    ...input.signal,
    score: raketScore,
    raket_score: raketScore,
    factors,
    why_moving: strongestFactors.map(
      (factor) => `${factor.label}: ${factor.evidence} (${factor.score}/100)`
    ),
    ai_summary: {
      bullish: strongestFactors.map((factor) => factor.evidence),
      bearish:
        risks.length > 0
          ? risks.map((factor) => `${factor.label} är svagare (${factor.score}/100)`)
          : ["Inga tydliga negativa edge-faktorer i mockmotorn"],
      risks: [
        input.signal.risk_level ?? "Likviditet, nyhetsrisk och snabb sentimentvändning",
        "Mockad feed behöver ersättas med validerade marknadsdata före skarpa beslut",
      ],
      triggers: [
        input.signal.trigger_source ?? input.signal.signal_type,
        ...strongestFactors.map((factor) => factor.label),
      ],
      confidence: clampScore(
        input.signal.confidence ?? factors.reduce((total, factor) => total + factor.score, 0) / factors.length
      ),
    },
  };
}

export function rankSignals(signals: StockSignal[]) {
  return signals
    .map((signal) => rankSignal({ signal }))
    .sort((a, b) => b.raket_score - a.raket_score);
}

export async function getStockSignals(limit = 50) {
  return supabase
    .from("stock_signals")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(limit);
}

export async function getRankedStockSignals(limit = 50) {
  const { data, error } = await getStockSignals(limit);

  if (error) {
    return { data: getMockSignalFeed().slice(0, limit), error };
  }

  const source = data && data.length > 0 ? data : getMockSignalRows();
  return { data: rankSignals(source).slice(0, limit), error: null };
}

export async function getSignalsForTicker(ticker: string, limit = 20) {
  return supabase
    .from("stock_signals")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .order("detected_at", { ascending: false })
    .limit(limit);
}

function buildMockSignal(
  ticker: string,
  companyName: string,
  score: number,
  signalType: string,
  action: string,
  description: string,
  overrides: Partial<StockSignal> = {}
): StockSignal {
  return {
    id: `mock-${ticker.toLowerCase()}`,
    ticker,
    company_name: companyName,
    market: "SE",
    score,
    signal_type: signalType,
    action,
    confidence: Math.min(94, score + 5),
    time_horizon: "1-4 veckor",
    trigger_source: "Mock live feed",
    risk_level: score >= 82 ? "Medel" : "Hög",
    description,
    ai_reason:
      "Mockmotorn kombinerar volymavvikelse, nyhetsimpact, socialt buzz, float/likviditet och momentum.",
    source_url: null,
    detected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function getMockSignalRows(): StockSignal[] {
  return [
    buildMockSignal(
      "NCC",
      "NCC AB",
      88,
      "PM + unusual volume",
      "STARK BEVAKNING",
      "Positivt partner-PM sammanfaller med 4.7x normal volym och stigande momentum.",
      { risk_level: "Medel", trigger_source: "PM + volym" }
    ),
    buildMockSignal(
      "NANO",
      "NanoMaterials Sweden",
      81,
      "Microcap momentum",
      "BEVAKA",
      "Tunn float, förbättrad likviditet och ökat socialt buzz efter kundpilot.",
      { trigger_source: "Social buzz + momentum" }
    ),
    buildMockSignal(
      "MEDI",
      "MediSignal AB",
      74,
      "Rapport",
      "AVVAKTA",
      "Rapporten visar bättre marginal men insider- och volymstödet är ännu blandat.",
      { risk_level: "Medel", trigger_source: "Rapport" }
    ),
  ];
}

export function getMockSignalFeed() {
  return rankSignals(getMockSignalRows());
}
