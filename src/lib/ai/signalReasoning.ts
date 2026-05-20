import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export interface SignalReasoning {
  whyRanksHigh: string;
  whatMarketMayMiss: string;
  biggestRisk: string;
  squeezePotential: string;
  setupType: string;
}

export function reasonAboutSignal(stock: RankedStock): SignalReasoning {
  return {
    whyRanksHigh: `${stock.ticker} rankar högt eftersom ${stock.reasons.slice(0, 2).join(" och ")}.`,
    whatMarketMayMiss: "Marknaden kan underskatta kombinationen av småbolagsfloat, insiderflöde och accelererande narrativ.",
    biggestRisk: stock.risks[0] ?? "Största risken är att signalen redan är utmattad.",
    squeezePotential: stock.tags.includes("squeeze")
      ? "Squeeze-potential finns och bör verifieras mot float, borrow och intradagsvolym."
      : "Squeeze är inte huvudcaset just nu.",
    setupType: stock.tags.includes("social heat")
      ? "Social/momentum setup"
      : stock.tags.includes("insider accumulation")
        ? "Insider accumulation setup"
        : "Multi-factor small-cap setup",
  };
}
