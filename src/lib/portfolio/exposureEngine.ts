import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export interface ExposureSummary {
  crowdedThemes: string[];
  concentrationRisk: number;
  sectorRisk: string[];
  smallCapExposure: number;
  warnings: string[];
}

export function analyzeExposure(stocks: RankedStock[]): ExposureSummary {
  const tagCounts = stocks
    .flatMap((stock) => stock.tags)
    .reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});
  const crowdedThemes = Object.entries(tagCounts)
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag);
  const smallCapExposure =
    stocks.length > 0
      ? Math.round(
          (stocks.filter((stock) => stock.tags.includes("småbolag")).length /
            stocks.length) *
            100
        )
      : 0;
  const concentrationRisk = Math.min(100, crowdedThemes.length * 18 + smallCapExposure * 0.35);
  const sectorRisk = crowdedThemes.filter((tag) =>
    ["AI", "biotech turnaround", "meme/social momentum", "battery/metals"].includes(tag)
  );

  return {
    crowdedThemes,
    concentrationRisk: Math.round(concentrationRisk),
    sectorRisk,
    smallCapExposure,
    warnings: [
      concentrationRisk >= 55 ? "Tematisk koncentration är hög." : null,
      smallCapExposure >= 70 ? "Portföljen är kraftigt småbolagsviktad." : null,
    ].filter((item): item is string => Boolean(item)),
  };
}
