import { resolveAvanzaSymbol, type AvanzaImportConfidence } from "@/lib/market/avanzaSymbolResolver";

export interface AvanzaImportRow {
  rowNumber: number;
  name: string;
  ticker: string;
  size: number;
  avgEntry: number;
  isin: string | null;
  exchange: string | null;
  sourceMarket: string | null;
  currency: string | null;
  country: string | null;
  type: string;
  status: "accepted" | "ignored" | "blocked";
  reason: string;
  tickerConfidence: number;
  confidenceLevel: AvanzaImportConfidence;
  isinMatch: boolean;
  marketMatch: boolean;
  canonicalTicker?: string;
  canonicalExchange?: string;
}

export interface AvanzaImportPreview {
  accepted: AvanzaImportRow[];
  ignored: AvanzaImportRow[];
  blocked: AvanzaImportRow[];
}

const REQUIRED_HEADERS = ["Namn", "Kortnamn", "Volym", "GAV (SEK)", "Valuta", "Land", "ISIN", "Marknad", "Typ"];

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseNumber(value?: string) {
  if (!value) return 0;
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

export function parseAvanzaCsv(text: string): AvanzaImportPreview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { accepted: [], ignored: [], blocked: [] };

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return {
      accepted: [],
      ignored: [],
      blocked: [
        {
          rowNumber: 1,
          name: "CSV",
          ticker: "",
          size: 0,
          avgEntry: 0,
          isin: null,
          exchange: null,
          sourceMarket: null,
          currency: null,
          country: null,
          type: "UNKNOWN",
          status: "blocked",
          reason: `Saknar kolumner: ${missing.join(", ")}`,
          tickerConfidence: 0,
          confidenceLevel: "REJECTED",
          isinMatch: false,
          marketMatch: false,
        },
      ],
    };
  }

  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const getCell = (cells: string[], header: string) => cells[indexByHeader.get(header) ?? -1]?.trim() ?? "";
  const preview: AvanzaImportPreview = { accepted: [], ignored: [], blocked: [] };

  lines.slice(1).forEach((line, offset) => {
    const cells = splitCsvLine(line);
    const type = getCell(cells, "Typ").toUpperCase();
    const ticker = getCell(cells, "Kortnamn").toUpperCase();
    const name = getCell(cells, "Namn");
    const rowBase = {
      rowNumber: offset + 2,
      name,
      ticker,
      size: parseNumber(getCell(cells, "Volym")),
      avgEntry: parseNumber(getCell(cells, "GAV (SEK)")),
      isin: getCell(cells, "ISIN") || null,
      exchange: getCell(cells, "Marknad") || null,
      sourceMarket: getCell(cells, "Marknad") || null,
      currency: getCell(cells, "Valuta") || null,
      country: getCell(cells, "Land") || null,
      type,
    };

    if (type !== "STOCK") {
      preview.ignored.push({
        ...rowBase,
        status: "ignored",
        reason: `Ignorerad Typ=${type || "saknas"}`,
        tickerConfidence: 0,
        confidenceLevel: "REJECTED",
        isinMatch: false,
        marketMatch: false,
      });
      return;
    }

    const resolution = resolveAvanzaSymbol({
      ticker,
      companyName: name,
      isin: rowBase.isin,
      market: rowBase.sourceMarket,
      currency: rowBase.currency,
      country: rowBase.country,
    });

    if (resolution.blocked || resolution.confidenceLevel === "LOW" || resolution.confidenceLevel === "REJECTED") {
      preview.blocked.push({
        ...rowBase,
        status: "blocked",
        reason: resolution.reason,
        tickerConfidence: resolution.confidence,
        confidenceLevel: resolution.confidenceLevel,
        isinMatch: resolution.isinMatch,
        marketMatch: resolution.marketMatch,
        canonicalTicker: resolution.resolvedTicker,
        canonicalExchange: resolution.exchange,
      });
      return;
    }

    preview.accepted.push({
      ...rowBase,
      name: resolution.companyName,
      ticker: resolution.resolvedTicker,
      exchange: resolution.exchange,
      currency: rowBase.currency || resolution.currency,
      country: rowBase.country || resolution.country,
      status: "accepted",
      reason: resolution.reason,
      tickerConfidence: resolution.confidence,
      confidenceLevel: resolution.confidenceLevel,
      isinMatch: resolution.isinMatch,
      marketMatch: resolution.marketMatch,
      canonicalTicker: resolution.resolvedTicker,
      canonicalExchange: resolution.exchange,
    });
  });

  return preview;
}
