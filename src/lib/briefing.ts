import { runAlertsEngine, type TradingAlert } from "./alertsEngine";
import type { PortfolioPosition } from "./portfolio";
import type { MarketSnapshot } from "./providers/types";
import type { RankedStockSignal } from "./signals";

export type BriefingInput = {
  snapshot: MarketSnapshot;
  portfolio: PortfolioPosition[];
  watchlistTickers: string[];
  previousScores?: Record<string, number>;
};

export type BriefingAction = {
  ticker: string;
  action: string;
  reason: string;
};

export type BriefingResult = {
  title: string;
  marketTone: string;
  topCandidates: RankedStockSignal[];
  portfolioActions: BriefingAction[];
  riskWarnings: string[];
  watchlistFocus: string[];
  alertsToCreate: TradingAlert[];
  plainSwedishSummary: string;
};

function marketToneFromCandidates(candidates: RankedStockSignal[]) {
  if (candidates.length === 0) return "Live data ej aktiverad";
  const average =
    candidates.reduce((total, candidate) => total + candidate.raket_score, 0) /
    candidates.length;

  if (average >= 75) return "Risk-on med flera starka edge-kandidater";
  if (average >= 60) return "Selektivt positiv ton";
  if (average >= 45) return "Blandad ton, kräver selektivitet";
  return "Risk-off eller låg edge";
}

export function identifyTodayTopCandidates(input: BriefingInput) {
  return input.snapshot.candidates
    .filter((candidate) => candidate.raket_score >= 65)
    .slice(0, 3);
}

export function identifyDeadMoney(input: BriefingInput): BriefingAction[] {
  const scores = new Map(
    input.snapshot.candidates.map((candidate) => [
      candidate.ticker.toUpperCase(),
      candidate,
    ])
  );

  return input.portfolio
    .map((position) => {
      const signal = scores.get(position.ticker.toUpperCase());
      if (!signal) return null;

      const momentum = signal.factors.find((factor) => factor.key === "momentum");
      if (signal.raket_score >= 60 || !momentum || momentum.score >= 45) {
        return null;
      }

      return {
        ticker: position.ticker,
        action: "Utvärdera kapitalbindning",
        reason: `${position.ticker} har låg edge (${signal.raket_score}/100) och svagt momentum.`,
      };
    })
    .filter((item): item is BriefingAction => Boolean(item));
}

export function summarizePortfolioRisk(input: BriefingInput) {
  const warnings: string[] = [];
  const portfolioValue = input.portfolio.reduce(
    (total, position) => total + position.shares * position.current_price,
    0
  );

  for (const position of input.portfolio) {
    const value = position.shares * position.current_price;
    const weight = portfolioValue > 0 ? (value / portfolioValue) * 100 : 0;

    if (weight >= 35) {
      warnings.push(`${position.ticker} är över ${weight.toFixed(0)}% av portföljen.`);
    }

    if (position.risk_note) {
      warnings.push(`${position.ticker}: ${position.risk_note}`);
    }
  }

  if (warnings.length === 0) {
    warnings.push("Inga tydliga portföljrisker från nuvarande data.");
  }

  return warnings.slice(0, 4);
}

export function identifyAlertTriggers(input: BriefingInput) {
  return runAlertsEngine({
    snapshot: input.snapshot,
    portfolio: input.portfolio,
    previousScores: input.previousScores,
  });
}

function identifyWatchlistFocus(input: BriefingInput) {
  const watchlist = new Set(
    input.watchlistTickers.map((ticker) => ticker.toUpperCase())
  );

  return input.snapshot.candidates
    .filter((candidate) => watchlist.has(candidate.ticker.toUpperCase()))
    .slice(0, 4)
    .map(
      (candidate) =>
        `${candidate.ticker}: ${candidate.raket_score}/100 - ${candidate.why_moving[0] ?? "bevaka ny trigger"}`
    );
}

function portfolioActions(input: BriefingInput): BriefingAction[] {
  const topCandidates = identifyTodayTopCandidates(input);
  const deadMoney = identifyDeadMoney(input);
  const actions = [...deadMoney];

  if (topCandidates.length > 0) {
    actions.push({
      ticker: topCandidates[0].ticker,
      action: "Prioritera research",
      reason: `${topCandidates[0].ticker} är dagens starkaste kandidat med RaketScore ${topCandidates[0].raket_score}/100.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      ticker: "PORTFÖLJ",
      action: "Avvakta",
      reason: "Ingen akut portföljåtgärd från nuvarande feed.",
    });
  }

  return actions.slice(0, 5);
}

function buildBrief(input: BriefingInput, title: string): BriefingResult {
  const topCandidates = identifyTodayTopCandidates(input);
  const alertsToCreate = identifyAlertTriggers(input).slice(0, 6);
  const actions = portfolioActions(input);
  const riskWarnings = summarizePortfolioRisk(input);
  const watchlistFocus = identifyWatchlistFocus(input);
  const topText =
    topCandidates.length > 0
      ? topCandidates
          .map((candidate) => `${candidate.ticker} (${candidate.raket_score})`)
          .join(", ")
      : "inga starka kandidater";

  return {
    title,
    marketTone: marketToneFromCandidates(input.snapshot.candidates),
    topCandidates,
    portfolioActions: actions,
    riskWarnings,
    watchlistFocus:
      watchlistFocus.length > 0
        ? watchlistFocus
        : ["Ingen watchlist-träff med stark edge just nu."],
    alertsToCreate,
    plainSwedishSummary: `${title}: marknadstonen är ${marketToneFromCandidates(
      input.snapshot.candidates
    ).toLowerCase()}. Toppkandidater: ${topText}. ${actions[0]?.reason ?? ""}`,
  };
}

export function generateMorningBrief(input: BriefingInput) {
  return buildBrief(input, "Morgonbrief");
}

export function generateAfterCloseBrief(input: BriefingInput) {
  return buildBrief(input, "Efter stängning-brief");
}
