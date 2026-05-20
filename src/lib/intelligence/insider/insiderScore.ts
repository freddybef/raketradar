import type { InsiderEvent, InsiderSignal } from "./insiderTypes";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roleWeight(role: string) {
  const lower = role.toLowerCase();
  if (lower.includes("vd") || lower.includes("ceo")) return 1.55;
  if (lower.includes("cfo") || lower.includes("finans")) return 1.35;
  if (lower.includes("ordförande") || lower.includes("chair")) return 1.25;
  if (lower.includes("styrelse") || lower.includes("board")) return 1.15;
  return 1;
}

export function calculateInsiderSignal(
  ticker: string,
  events: InsiderEvent[],
  marketCapSek?: number
): InsiderSignal {
  const scoped = events.filter(
    (event) => event.ticker.toUpperCase() === ticker.toUpperCase()
  );
  const buyEvents = scoped.filter((event) => event.type === "buy");
  const sellEvents = scoped.filter((event) => event.type === "sell");
  const weightedBuy = buyEvents.reduce(
    (sum, event) => sum + event.valueSek * roleWeight(event.role),
    0
  );
  const weightedSell = sellEvents.reduce(
    (sum, event) => sum + event.valueSek * roleWeight(event.role),
    0
  );
  const buyValueSek = buyEvents.reduce((sum, event) => sum + event.valueSek, 0);
  const sellValueSek = sellEvents.reduce((sum, event) => sum + event.valueSek, 0);
  const marketCapBoost =
    marketCapSek && marketCapSek > 0
      ? Math.min(22, (buyValueSek / marketCapSek) * 10000)
      : 0;
  const smallCapBoost = marketCapSek && marketCapSek < 1000000000 ? 9 : 0;
  const repeatedBuyBoost = buyEvents.length >= 2 ? 12 : 0;
  const sellSpamPenalty = sellEvents.length >= 3 ? 28 : sellEvents.length * 8;
  const raw = 50 + weightedBuy / 80000 - weightedSell / 90000 + marketCapBoost + smallCapBoost + repeatedBuyBoost - sellSpamPenalty;
  const score = clamp(raw);
  const direction = score >= 62 ? "bullish" : score <= 42 ? "bearish" : "neutral";
  const reasons: string[] = [];

  if (buyEvents.some((event) => roleWeight(event.role) >= 1.5)) {
    reasons.push("VD/CEO-köp ger hög signalvikt");
  }
  if (buyEvents.length >= 2) reasons.push("Upprepade insiderköp");
  if (smallCapBoost > 0) reasons.push("Småbolagsboost för insideraktivitet");
  if (marketCapBoost > 0) reasons.push("Köp är relevant relativt market cap");
  if (sellSpamPenalty >= 24) reasons.push("Flera insiderförsäljningar drar ned signalen");
  if (reasons.length === 0) reasons.push("Ingen stark insideravvikelse");

  return {
    ticker: ticker.toUpperCase(),
    score,
    direction,
    strength: Math.abs(score - 50) * 2,
    reasons,
    buyValueSek,
    sellValueSek,
  };
}
