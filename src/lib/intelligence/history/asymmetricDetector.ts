import type { RankedStock } from "../ranking/rankStocks";

export interface AsymmetricSetup {
  ticker: string;
  score: number;
  lowDownside: boolean;
  explosiveUpsidePotential: boolean;
  ignoredSetup: boolean;
  stealthAccumulation: boolean;
  preBreakoutCompression: boolean;
  reason: string;
}

export function detectAsymmetricSetup(stock: RankedStock): AsymmetricSetup {
  const stealthAccumulation = stock.tags.includes("insider accumulation");
  const explosiveUpsidePotential =
    stock.tags.includes("squeeze") || stock.tags.includes("social heat");
  const ignoredSetup =
    !stock.tags.includes("social heat") && stock.reasons.some((reason) => reason.toLowerCase().includes("insider"));
  const preBreakoutCompression =
    stock.conviction >= 65 && stock.totalScore >= 70 && !stock.tags.includes("parabolisk");
  const lowDownside = stock.risks.length <= 2 && stealthAccumulation;
  const score = Math.min(
    100,
    35 +
      (lowDownside ? 18 : 0) +
      (explosiveUpsidePotential ? 22 : 0) +
      (ignoredSetup ? 14 : 0) +
      (stealthAccumulation ? 18 : 0) +
      (preBreakoutCompression ? 12 : 0)
  );

  return {
    ticker: stock.ticker,
    score,
    lowDownside,
    explosiveUpsidePotential,
    ignoredSetup,
    stealthAccumulation,
    preBreakoutCompression,
    reason:
      score >= 75
        ? "Marknaden har ännu inte vaknat fullt ut, men flera asymmetriska signaler ligger i linje."
        : "Asymmetrin är inte tillräckligt tydlig ännu.",
  };
}
