import type { PortfolioPosition } from "./portfolio";
import type { RankedStockSignal } from "./signals";
import type {
  InsiderEvent,
  MarketSnapshot,
  SocialSignal,
  StockNews,
} from "./providers/types";

export type TradingAlertSeverity = "low" | "medium" | "high" | "critical";

export type TradingAlert = {
  ticker: string;
  severity: TradingAlertSeverity;
  reason: string;
  recommendedAction: string;
  evidence: string[];
  createdAt: string;
  expiresAt: string;
};

export type AlertEngineInput = {
  snapshot: MarketSnapshot;
  portfolio: PortfolioPosition[];
  previousScores?: Record<string, number>;
  reportDates?: Record<string, string>;
};

function hoursFromNow(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function alert(
  ticker: string,
  severity: TradingAlertSeverity,
  reason: string,
  recommendedAction: string,
  evidence: string[],
  expiresInHours = 24
): TradingAlert {
  return {
    ticker,
    severity,
    reason,
    recommendedAction,
    evidence,
    createdAt: new Date().toISOString(),
    expiresAt: hoursFromNow(expiresInHours),
  };
}

function getFactor(signal: RankedStockSignal, key: string) {
  return signal.factors.find((factor) => factor.key === key);
}

function isReportNearby(dateValue: string) {
  const today = new Date();
  const reportDate = new Date(dateValue);
  const diffDays =
    (reportDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= 3;
}

function newsForTicker(news: StockNews[], ticker: string) {
  return news.filter((item) => item.tickers.includes(ticker));
}

function insiderForTicker(events: InsiderEvent[], ticker: string) {
  return events.filter((event) => event.symbol.replace(".ST", "") === ticker);
}

function socialForTicker(signals: SocialSignal[], ticker: string) {
  return signals.find((signal) => signal.symbol.replace(".ST", "") === ticker);
}

export function runAlertsEngine(input: AlertEngineInput): TradingAlert[] {
  const alerts: TradingAlert[] = [];
  const holdings = new Map(
    input.portfolio.map((position) => [position.ticker.toUpperCase(), position])
  );

  for (const signal of input.snapshot.candidates) {
    const ticker = signal.ticker.toUpperCase();
    const volume = getFactor(signal, "unusualVolume");
    const newsImpact = getFactor(signal, "newsImpact");
    const social = socialForTicker(input.snapshot.socialSignals, ticker);
    const insiderEvents = insiderForTicker(input.snapshot.insiderEvents, ticker);
    const relatedNews = newsForTicker(input.snapshot.news, ticker);
    const previousScore = input.previousScores?.[ticker];

    if (volume && volume.score >= 78) {
      alerts.push(
        alert(ticker, "high", "Ovanlig volym", "Kontrollera orderbok, spread och nyhetskälla innan beslut.", [
          volume.evidence,
          `RaketScore ${signal.raket_score}/100`,
        ])
      );
    }

    if (signal.raket_score >= 75 && (!previousScore || previousScore < 75)) {
      alerts.push(
        alert(ticker, "high", "Score passerar 75", "Lägg på aktiv bevakning och definiera entry/invalidationsnivå.", [
          `Nuvarande RaketScore ${signal.raket_score}/100`,
          previousScore ? `Föregående score ${previousScore}/100` : "Ingen tidigare score registrerad",
        ])
      );
    }

    if (signal.raket_score < 45 && previousScore && previousScore >= 45) {
      alerts.push(
        alert(ticker, "medium", "Score faller under 45", "Sänk prioritet eller kräva ny trigger innan kapital binds.", [
          `Nuvarande RaketScore ${signal.raket_score}/100`,
          `Föregående score ${previousScore}/100`,
        ])
      );
    }

    if (newsImpact && newsImpact.score >= 78) {
      alerts.push(
        alert(ticker, "high", "Hög nyhetsimpact", "Läs primärkällan och kontrollera om marknaden redan prisat in nyheten.", [
          newsImpact.evidence,
          relatedNews[0]?.title ?? "Nyhetstrigger från provider feed",
        ])
      );
    }

    if (insiderEvents.some((event) => event.eventType === "buy")) {
      alerts.push(
        alert(ticker, "medium", "Insider event", "Jämför insiderköpet med historiskt ägande och likviditet.", [
          ...insiderEvents.map(
            (event) => `${event.insiderName}: ${event.eventType}, ${event.valueSek ?? 0} SEK`
          ),
        ])
      );
    }

    if (social && social.buzzScore >= 82) {
      alerts.push(
        alert(ticker, "medium", "Social buzz spike", "Separera hype från verifierbara triggers innan position tas.", [
          `${social.mentions} omnämnanden`,
          `BuzzScore ${social.buzzScore}/100`,
        ])
      );
    }

    const holding = holdings.get(ticker);
    if (holding && signal.raket_score < 55) {
      alerts.push(
        alert(ticker, "high", "Portföljinnehav med svag edge", "Utvärdera stop loss, positionsstorlek och om caset fortfarande gäller.", [
          `RaketScore ${signal.raket_score}/100`,
          holding.risk_note ?? "Ingen risknotering finns på innehavet",
        ])
      );
    }

    const reportDate = input.reportDates?.[ticker];
    if (reportDate && isReportNearby(reportDate)) {
      alerts.push(
        alert(ticker, "medium", "Rapportdag nära", "Bestäm om du vill minska risk före rapport eller hålla genom eventet.", [
          `Rapportdatum ${new Intl.DateTimeFormat("sv-SE").format(new Date(reportDate))}`,
        ], 72)
      );
    }

    const momentum = getFactor(signal, "momentum");
    if (holding && momentum && momentum.score < 42 && signal.raket_score < 60) {
      alerts.push(
        alert(ticker, "medium", "Dead money warning", "Kapital kan vara låst utan aktiv trigger. Jämför mot dagens toppkandidater.", [
          momentum.evidence,
          `RaketScore ${signal.raket_score}/100`,
        ])
      );
    }
  }

  return alerts.sort((a, b) => {
    const severityRank: Record<TradingAlertSeverity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return severityRank[b.severity] - severityRank[a.severity];
  });
}
