import type { StockNews } from "@/lib/providers/types";

export type PreOpenCatalystType =
  | "order"
  | "ramavtal"
  | "LOI"
  | "företrädesemission"
  | "riktad emission"
  | "finansiering säkrad"
  | "bud"
  | "uppköp"
  | "FDA/CE/kliniska data"
  | "rapport/omvänd vinstvarning"
  | "VD-byte"
  | "strategisk översyn"
  | "insiderköp"
  | "insidersälj"
  | "AI/försvar/cyber/datacenter narrative"
  | "okänd";

export interface PreOpenClassification {
  ticker: string;
  source: string;
  catalystType: PreOpenCatalystType;
  catalystStrength: number;
  gapProbability: number;
  continuationProbability: number;
  fakeSpikeRisk: number;
  timeSensitivity: number;
  evidence: string[];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function classifyText(text: string): PreOpenCatalystType {
  if (includesAny(text, ["företrädesemission", "foretradesemission"])) return "företrädesemission";
  if (includesAny(text, ["riktad emission", "private placement"])) return "riktad emission";
  if (includesAny(text, ["finansiering säkrad", "säkrar finansiering", "lånefacilitet", "kreditfacilitet"])) return "finansiering säkrad";
  if (includesAny(text, ["budplikt", "offentligt uppköpserbjudande", "lägger bud", "bud på"])) return "bud";
  if (includesAny(text, ["uppköp", "förvärvas", "takeover", "förvärvserbjudande"])) return "uppköp";
  if (includesAny(text, ["fda", "ema", "ce-märkning", "kliniska data", "klinisk studie", "fas ii", "fas 2", "topline"])) return "FDA/CE/kliniska data";
  if (includesAny(text, ["omvänd vinstvarning", "höjer prognos", "starkare än väntat", "delårsrapport", "bokslut", "rapport"])) return "rapport/omvänd vinstvarning";
  if (includesAny(text, ["ny vd", "vd avgår", "byter vd", "verkställande direktör"])) return "VD-byte";
  if (includesAny(text, ["strategisk översyn", "strategiska alternativ", "ser över verksamheten"])) return "strategisk översyn";
  if (includesAny(text, ["insiderköp", "köper aktier", "insynsperson köper"])) return "insiderköp";
  if (includesAny(text, ["insidersälj", "säljer aktier", "insynsperson säljer"])) return "insidersälj";
  if (includesAny(text, ["ramavtal", "framework agreement"])) return "ramavtal";
  if (includesAny(text, ["letter of intent", "avsiktsförklaring", "loi"])) return "LOI";
  if (includesAny(text, ["order", "beställning", "ordervärde", "kundorder"])) return "order";
  if (includesAny(text, ["ai", "försvar", "cyber", "datacenter", "säkerhet", "nato"])) return "AI/försvar/cyber/datacenter narrative";
  return "okänd";
}

function catalystBase(type: PreOpenCatalystType) {
  const scores: Record<PreOpenCatalystType, number> = {
    order: 80,
    ramavtal: 74,
    LOI: 54,
    företrädesemission: 42,
    "riktad emission": 58,
    "finansiering säkrad": 68,
    bud: 92,
    uppköp: 88,
    "FDA/CE/kliniska data": 88,
    "rapport/omvänd vinstvarning": 78,
    "VD-byte": 52,
    "strategisk översyn": 66,
    insiderköp: 68,
    insidersälj: 38,
    "AI/försvar/cyber/datacenter narrative": 72,
    okänd: 35,
  };
  return scores[type];
}

export function classifyPreOpenNews(news: StockNews[]): PreOpenClassification[] {
  return news.flatMap((item) => {
    const text = `${item.title} ${item.rawText} ${item.detectedTriggers.join(" ")}`.toLowerCase();
    const catalystType = classifyText(`${item.triggers.map((trigger) => trigger.type).join(" ")} ${text}`);
    const triggerImpact =
      item.triggers.length > 0
        ? Math.round(item.triggers.reduce((sum, trigger) => sum + trigger.impactScore, 0) / item.triggers.length)
        : catalystBase(catalystType);
    const ageHours = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 3600000);
    const freshnessBoost = Math.max(0, 18 - ageHours * 3);
    const bearish =
      item.triggers.some((trigger) => trigger.direction === "bearish") ||
      catalystType === "företrädesemission" ||
      catalystType === "insidersälj";
    const speculative = catalystType === "LOI" || catalystType === "AI/försvar/cyber/datacenter narrative";
    const highRisk = bearish || text.includes("varning") || text.includes("rekonstruktion");

    return item.tickers.map((ticker) => ({
      ticker,
      source: item.source,
      catalystType,
      catalystStrength: clamp(triggerImpact + freshnessBoost - (bearish ? 24 : 0) - (speculative ? 8 : 0)),
      gapProbability: clamp(triggerImpact * 0.62 + freshnessBoost + (["bud", "uppköp"].includes(catalystType) ? 20 : 0)),
      continuationProbability: clamp(triggerImpact * 0.52 + item.freshnessScore * 0.25 - (highRisk ? 28 : 0) - (speculative ? 12 : 0)),
      fakeSpikeRisk: clamp((highRisk ? 62 : 24) + (speculative ? 18 : 0) + (ageHours > 8 ? 18 : 0) + (item.triggers.length === 0 ? 18 : 0)),
      timeSensitivity: clamp(100 - ageHours * 10),
      evidence: [
        item.title,
        item.triggers[0]?.evidence,
        item.source,
      ].filter((value): value is string => Boolean(value)),
    }));
  });
}
