import type { MarketRegion } from "@/lib/market/tickerIdentity";

export type AvanzaImportConfidence = "VERIFIED" | "HIGH" | "MEDIUM" | "LOW" | "REJECTED";

export interface AvanzaResolvedSymbol {
  originalTicker: string;
  resolvedTicker: string;
  companyName: string;
  exchange: MarketRegion;
  country: string;
  currency: string;
  isin: string | null;
  confidence: number;
  confidenceLevel: AvanzaImportConfidence;
  reason: string;
  isinMatch: boolean;
  marketMatch: boolean;
  blocked: boolean;
}

interface SwedishEquityRegistryEntry {
  ticker: string;
  aliases: string[];
  companyName: string;
  exchange: MarketRegion;
  isin?: string;
  country: string;
  currency: string;
}

const SWEDISH_MARKET_HINTS = [
  "stockholm",
  "nasdaq stockholm",
  "first north",
  "spotlight",
  "nordic sme",
  "ngm",
  "aktietorget",
  "stockholm mid cap",
  "stockholm small cap",
  "stockholm large cap",
];

const BLOCKED_US_TICKERS = new Set(["BIOX"]);

const REGISTRY: SwedishEquityRegistryEntry[] = [
  { ticker: "HOIST", aliases: ["HOIST"], companyName: "Hoist Finance AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "BIOA", aliases: ["BIOA", "BIOA B", "BIOARCTIC", "BIOARCTIC B"], companyName: "BioArctic AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "TOBII", aliases: ["TOBII", "TOBII AB"], companyName: "Tobii AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "SINCH", aliases: ["SINCH"], companyName: "Sinch AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "YUBICO", aliases: ["YUBICO"], companyName: "Yubico AB", exchange: "First North", country: "SE", currency: "SEK" },
  { ticker: "ASTOR", aliases: ["ASTOR", "ASTOR GROUP"], companyName: "Astor Group AB", exchange: "Spotlight", country: "SE", currency: "SEK" },
  { ticker: "SIVE", aliases: ["SIVE", "SIVERS", "SIVERS SEMICONDUCTORS"], companyName: "Sivers Semiconductors AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "ADVE", aliases: ["ADVE", "ADVENTURE BOX"], companyName: "Adventure Box Technology AB", exchange: "Spotlight", country: "SE", currency: "SEK" },
  { ticker: "ACCON", aliases: ["ACCON", "AAC CLYDE SPACE", "AAC"], companyName: "AAC Clyde Space AB", exchange: "First North", country: "SE", currency: "SEK" },
  { ticker: "SHT", aliases: ["SHT", "SMART HIGH TECH"], companyName: "Smart High Tech AB", exchange: "Spotlight", country: "SE", currency: "SEK" },
  { ticker: "SBB B", aliases: ["SBB B", "SBBB", "SAMHALLSBYGGNADSBOLAGET B", "SAMHALLSBYGGNADSBOLAGET"], companyName: "Samhallsbyggnadsbolaget i Norden AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "BERG B", aliases: ["BERG B", "BERGB", "BERGMAN & BEVING B", "BERGMAN BEVING"], companyName: "Bergman & Beving AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "CI B", aliases: ["CI B", "CIB", "CINT B", "CINT"], companyName: "Cint Group AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "NCC", aliases: ["NCC", "NCC B", "NCCB"], companyName: "NCC AB", exchange: "Sweden", isin: "SE0000117970", country: "SE", currency: "SEK" },
  { ticker: "MOFAST", aliases: ["MOFAST"], companyName: "Mofast AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "ELECTROLUX", aliases: ["ELECTROLUX", "ELUX", "ELUX B", "ELUXB"], companyName: "AB Electrolux", exchange: "Sweden", isin: "SE0016589188", country: "SE", currency: "SEK" },
  { ticker: "MANGOLD", aliases: ["MANGOLD"], companyName: "Mangold AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "NORDNET", aliases: ["NORDNET"], companyName: "Nordnet AB", exchange: "Sweden", isin: "SE0015192067", country: "SE", currency: "SEK" },
  { ticker: "LOGISTEA", aliases: ["LOGISTEA", "LOGISTEA B"], companyName: "Logistea AB", exchange: "Sweden", country: "SE", currency: "SEK" },
  { ticker: "NORDREST", aliases: ["NORDREST"], companyName: "Nordrest Holding AB", exchange: "First North", country: "SE", currency: "SEK" },
  { ticker: "MEDI", aliases: ["MEDI", "MEDIVIR"], companyName: "Medivir AB", exchange: "Sweden", isin: "SE0000273294", country: "SE", currency: "SEK" },
];

function normalizeText(value?: string | null) {
  return (value ?? "")
    .toUpperCase()
    .replace(/\(PUBL\)/g, "")
    .replace(/\bAB\b/g, "")
    .replace(/[ÅÄ]/g, "A")
    .replace(/Ö/g, "O")
    .replace(/É/g, "E")
    .replace(/&/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAvanzaSymbol(value: string) {
  const normalized = normalizeText(value)
    .replace(/\bST\b$/g, "")
    .replace(/\bTO\d*\b$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const noSpace = normalized.replace(/\s/g, "");
  if (/^[A-Z0-9]+[AB]$/.test(noSpace) && normalized.includes(" ")) return normalized;
  return normalized;
}

function marketLooksSwedish(market?: string | null, country?: string | null, currency?: string | null) {
  const normalizedMarket = normalizeText(market).toLowerCase();
  const countryOk = normalizeText(country) === "SE" || normalizeText(country) === "SVERIGE" || normalizeText(country) === "SWEDEN";
  const currencyOk = normalizeText(currency) === "SEK";
  return countryOk || currencyOk || SWEDISH_MARKET_HINTS.some((hint) => normalizedMarket.includes(hint));
}

function byIsin(isin?: string | null) {
  const normalized = isin?.trim().toUpperCase();
  if (!normalized) return null;
  return REGISTRY.find((entry) => entry.isin?.toUpperCase() === normalized) ?? null;
}

function byAlias(symbol: string) {
  const normalized = normalizeAvanzaSymbol(symbol);
  const compact = normalized.replace(/\s/g, "");
  return (
    REGISTRY.find((entry) => entry.aliases.some((alias) => normalizeAvanzaSymbol(alias) === normalized || normalizeAvanzaSymbol(alias).replace(/\s/g, "") === compact)) ??
    null
  );
}

function byCompanyName(name?: string | null) {
  const normalized = normalizeText(name);
  if (!normalized) return null;
  return (
    REGISTRY.find((entry) => {
      const canonical = normalizeText(entry.companyName);
      return canonical === normalized || canonical.includes(normalized) || normalized.includes(canonical);
    }) ?? null
  );
}

function confidenceLevel(score: number, blocked: boolean): AvanzaImportConfidence {
  if (blocked) return "REJECTED";
  if (score >= 96) return "VERIFIED";
  if (score >= 82) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score >= 40) return "LOW";
  return "REJECTED";
}

export function resolveAvanzaSymbol(input: {
  ticker: string;
  companyName: string;
  isin?: string | null;
  market?: string | null;
  currency?: string | null;
  country?: string | null;
}): AvanzaResolvedSymbol {
  const normalizedTicker = normalizeAvanzaSymbol(input.ticker);
  const swedishMarket = marketLooksSwedish(input.market, input.country, input.currency);

  if (BLOCKED_US_TICKERS.has(normalizedTicker.replace(/\s/g, ""))) {
    return {
      originalTicker: input.ticker,
      resolvedTicker: normalizedTicker,
      companyName: input.companyName,
      exchange: "Nasdaq US",
      country: "US",
      currency: "USD",
      isin: input.isin ?? null,
      confidence: 0,
      confidenceLevel: "REJECTED",
      reason: "BIOX ar en USA/Nasdaq-symbol och blockeras i svensk Avanza-import.",
      isinMatch: false,
      marketMatch: false,
      blocked: true,
    };
  }

  const isinMatch = byIsin(input.isin);
  const tickerMatch = byAlias(normalizedTicker);
  const nameMatch = byCompanyName(input.companyName);
  const selected = isinMatch ?? tickerMatch ?? nameMatch;
  const matchReason = isinMatch ? "ISIN match" : tickerMatch ? "Ticker match" : nameMatch ? "Fuzzy bolagsnamn" : "Svensk equity via Avanza-marknad";

  if (!selected && !swedishMarket) {
    return {
      originalTicker: input.ticker,
      resolvedTicker: normalizedTicker,
      companyName: input.companyName,
      exchange: "Nasdaq US",
      country: input.country ?? "unknown",
      currency: input.currency ?? "unknown",
      isin: input.isin ?? null,
      confidence: 0,
      confidenceLevel: "REJECTED",
      reason: "Saknar svensk marknadsbekraftelse och canonical match.",
      isinMatch: false,
      marketMatch: false,
      blocked: true,
    };
  }

  const resolvedTicker = selected?.ticker ?? normalizedTicker;
  const exchange = selected?.exchange ?? inferExchange(input.market);
  const confidence =
    (isinMatch ? 75 : 0) +
    (tickerMatch ? 58 : 0) +
    (nameMatch ? 25 : 0) +
    (swedishMarket ? 20 : 0) +
    (selected ? 5 : 0);
  const score = Math.min(100, selected ? confidence : swedishMarket ? 62 : confidence);
  const blocked = score < 45 || exchange === "Nasdaq US";

  return {
    originalTicker: input.ticker,
    resolvedTicker,
    companyName: selected?.companyName ?? input.companyName,
    exchange,
    country: selected?.country ?? input.country ?? "SE",
    currency: selected?.currency ?? input.currency ?? "SEK",
    isin: input.isin ?? selected?.isin ?? null,
    confidence: score,
    confidenceLevel: confidenceLevel(score, blocked),
    reason: blocked ? "For lag confidence efter Avanza-resolve." : matchReason,
    isinMatch: Boolean(isinMatch),
    marketMatch: swedishMarket,
    blocked,
  };
}

function inferExchange(market?: string | null): MarketRegion {
  const normalized = normalizeText(market).toLowerCase();
  if (normalized.includes("first north")) return "First North";
  if (normalized.includes("spotlight")) return "Spotlight";
  if (normalized.includes("nordic sme") || normalized.includes("ngm")) return "Nordic SME";
  return "Sweden";
}
