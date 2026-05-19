import type { StockNews } from "@/lib/providers/types";

export interface OvernightContext {
  nasdaqFutures: "positive" | "neutral" | "negative" | "unknown";
  sectorMomentum: Array<{ sector: string; direction: "strong" | "neutral" | "weak"; score: number }>;
  activeThemes: string[];
  alignmentScore: number;
}

function inferThemes(news: StockNews[]) {
  const text = news.map((item) => `${item.title} ${item.rawText} ${item.categories.join(" ")}`).join(" ").toLowerCase();
  return [
    text.includes("ai") || text.includes("datacenter") ? "AI/datacenter" : null,
    text.includes("försvar") || text.includes("nato") ? "försvar" : null,
    text.includes("cyber") ? "cyber" : null,
    text.includes("biotech") || text.includes("klinisk") || text.includes("fda") ? "biotech" : null,
  ].filter((item): item is string => Boolean(item));
}

export function buildOvernightContext(news: StockNews[]): OvernightContext {
  const activeThemes = inferThemes(news);
  const nasdaqHint = process.env.NASDAQ_FUTURES_TONE?.toLowerCase();
  const nasdaqFutures =
    nasdaqHint === "positive" || nasdaqHint === "negative" || nasdaqHint === "neutral"
      ? nasdaqHint
      : "unknown";
  const sectorMomentum = [
    {
      sector: "AI/datacenter",
      direction: activeThemes.includes("AI/datacenter") ? "strong" as const : "neutral" as const,
      score: activeThemes.includes("AI/datacenter") ? 72 : 50,
    },
    {
      sector: "försvar/cyber",
      direction: activeThemes.some((theme) => theme === "försvar" || theme === "cyber") ? "strong" as const : "neutral" as const,
      score: activeThemes.some((theme) => theme === "försvar" || theme === "cyber") ? 70 : 50,
    },
    {
      sector: "biotech",
      direction: activeThemes.includes("biotech") ? "strong" as const : "neutral" as const,
      score: activeThemes.includes("biotech") ? 74 : 50,
    },
  ];
  const macroBoost = nasdaqFutures === "positive" ? 8 : nasdaqFutures === "negative" ? -8 : 0;

  return {
    nasdaqFutures,
    sectorMomentum,
    activeThemes,
    alignmentScore: Math.max(
      0,
      Math.min(100, Math.round(50 + activeThemes.length * 8 + macroBoost))
    ),
  };
}
