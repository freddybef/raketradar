import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";

export interface FiInsiderRawEvent {
  publicationDate: string;
  issuer: string;
  insiderName: string;
  role: string;
  transactionType: string;
  instrumentName: string;
  isin: string;
  transactionDate: string;
  volume: number | null;
  price: number | null;
  currency: string;
}

export interface FiInsiderSignal {
  ticker: string;
  issuer: string;
  events: InsiderEvent[];
  clusterBuying: boolean;
  ceoAccumulation: boolean;
  stealthAccumulation: boolean;
  evidence: string[];
}

export interface FiInsiderFetchResult {
  events: InsiderEvent[];
  rawEvents: FiInsiderRawEvent[];
  sourceUrl: string;
  fetchedAt: string;
  latencyMs: number;
  ok: boolean;
  status: "healthy" | "empty" | "error";
  error?: string;
}

const DEFAULT_FI_URL = "https://marknadssok.fi.se/Publiceringsklient";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&aring;/g, "å")
    .replace(/&Aring;/g, "Å")
    .replace(/&auml;/g, "ä")
    .replace(/&Auml;/g, "Ä")
    .replace(/&#246;/g, "ö")
    .replace(/&#214;/g, "Ö")
    .replace(/&#229;/g, "å")
    .replace(/&#197;/g, "Å")
    .replace(/&#228;/g, "ä")
    .replace(/&#196;/g, "Ä")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  const normalized = decodeHtml(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string) {
  const clean = decodeHtml(value);
  const isoMatch = clean.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const svMatch = clean.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (!svMatch) return clean;

  return `${svMatch[3]}-${svMatch[2]}-${svMatch[1]}`;
}

export function issuerToTicker(issuer: string, knownSymbols: Record<string, string>) {
  const normalized = issuer
    .toLowerCase()
    .replace(/\(publ\)/g, "")
    .replace(/\bab\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const direct = knownSymbols[normalized];
  if (direct) return direct;

  return issuer
    .replace(/\(publ\)/gi, "")
    .replace(/\bAB\b/g, "")
    .trim()
    .split(/\s+/)[0]
    .toUpperCase();
}

export function parseFiHtml(html: string): FiInsiderRawEvent[] {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  return rowMatches
    .map((row) => {
      const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/gi)].map((match) =>
        decodeHtml(match[0])
      );
      if (cells.length < 15) return null;

      return {
        publicationDate: normalizeDate(cells[0]),
        issuer: cells[1],
        insiderName: cells[2],
        role: cells[3],
        transactionType: cells[5],
        instrumentName: cells[6],
        isin: cells[8],
        transactionDate: normalizeDate(cells[9]),
        volume: parseNumber(cells[10]),
        price: parseNumber(cells[12]),
        currency: cells[13] || "SEK",
      };
    })
    .filter((event): event is FiInsiderRawEvent => Boolean(event));
}

function parseFiDelimited(body: string): FiInsiderRawEvent[] {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((header) => header.toLowerCase().trim());

  const find = (row: string[], candidates: string[]) => {
    const index = headers.findIndex((header) =>
      candidates.some((candidate) => header.includes(candidate))
    );
    return index >= 0 ? row[index] ?? "" : "";
  };

  return lines
    .slice(1)
    .map((line) => {
      const row = line.split(separator).map((cell) => cell.replace(/^"|"$/g, "").trim());

      return {
        publicationDate: normalizeDate(find(row, ["publicering", "publication"])),
        issuer: find(row, ["emittent", "issuer", "bolag"]),
        insiderName: find(row, ["person", "insider", "namn"]),
        role: find(row, ["befattning", "roll", "position"]),
        transactionType: find(row, ["karaktär", "karaktar", "transaktion", "transaction"]),
        instrumentName: find(row, ["instrument"]),
        isin: find(row, ["isin"]),
        transactionDate: normalizeDate(find(row, ["transaktionsdatum", "date"])),
        volume: parseNumber(find(row, ["volym", "antal", "quantity"])),
        price: parseNumber(find(row, ["pris", "price"])),
        currency: find(row, ["valuta", "currency"]) || "SEK",
      };
    })
    .filter((event) => event.issuer && event.insiderName);
}

function toInsiderEvent(
  raw: FiInsiderRawEvent,
  knownSymbols: Record<string, string>
): InsiderEvent {
  const ticker = issuerToTicker(raw.issuer, knownSymbols);
  const type = raw.transactionType.toLowerCase().includes("avyttring")
    ? "sell"
    : "buy";

  return {
    ticker,
    insiderName: raw.insiderName,
    role: raw.role,
    type,
    valueSek: (raw.volume ?? 0) * (raw.price ?? 0),
    date: raw.transactionDate || raw.publicationDate,
  };
}

export function parseFiInsiderEventsFromBody(
  body: string,
  knownSymbols: Record<string, string> = {},
  limit = 50
) {
  const rawEvents = body.includes("<tr") ? parseFiHtml(body) : parseFiDelimited(body);
  const limitedRawEvents = rawEvents.slice(0, limit);

  return {
    rawEvents: limitedRawEvents,
    events: limitedRawEvents.map((event) => toInsiderEvent(event, knownSymbols)),
  };
}

export async function fetchFiInsiderSnapshot(options?: {
  sourceUrl?: string;
  knownSymbols?: Record<string, string>;
  limit?: number;
}): Promise<FiInsiderFetchResult> {
  const sourceUrl =
    options?.sourceUrl ??
    process.env.FI_INSIDER_SOURCE_URL ??
    DEFAULT_FI_URL;
  const knownSymbols = options?.knownSymbols ?? {};
  const startedAt = Date.now();

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/csv",
        "User-Agent": "RaketRadar/0.1 research adapter",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        events: [],
        rawEvents: [],
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        ok: false,
        status: "error",
        error: `FI svarade ${response.status}`,
      };
    }

    const body = await response.text();
    const parsed = parseFiInsiderEventsFromBody(
      body,
      knownSymbols,
      options?.limit ?? 50
    );

    return {
      ...parsed,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      ok: parsed.events.length > 0,
      status: parsed.events.length > 0 ? "healthy" : "empty",
      error:
        parsed.events.length > 0
          ? undefined
          : "FI-källan gav inga parsebara insiderhändelser",
    };
  } catch (error) {
    return {
      events: [],
      rawEvents: [],
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      ok: false,
      status: "error",
      error: String(error),
    };
  }
}

export async function fetchLatestInsiderEvents(options?: {
  sourceUrl?: string;
  knownSymbols?: Record<string, string>;
  limit?: number;
}): Promise<InsiderEvent[]> {
  const snapshot = await fetchFiInsiderSnapshot(options);
  return snapshot.events;
}

export function detectInsiderPatterns(events: InsiderEvent[]): FiInsiderSignal[] {
  const grouped = events.reduce<Record<string, InsiderEvent[]>>((acc, event) => {
    acc[event.ticker] = [...(acc[event.ticker] ?? []), event];
    return acc;
  }, {});

  return Object.entries(grouped).map(([ticker, tickerEvents]) => {
    const buys = tickerEvents.filter((event) => event.type === "buy");
    const ceoBuys = buys.filter((event) =>
      /vd|ceo|verkställande/i.test(event.role)
    );
    const totalBuyValue = buys.reduce((sum, event) => sum + event.valueSek, 0);

    return {
      ticker,
      issuer: ticker,
      events: tickerEvents,
      clusterBuying: buys.length >= 3,
      ceoAccumulation: ceoBuys.length > 0,
      stealthAccumulation: buys.length >= 2 && totalBuyValue >= 250000,
      evidence: [
        buys.length >= 3 ? `${buys.length} köp i kluster` : null,
        ceoBuys.length > 0 ? "VD/CEO deltar i köpflödet" : null,
        totalBuyValue >= 250000
          ? `Ackumulerat köpflöde ${Math.round(totalBuyValue).toLocaleString("sv-SE")} SEK`
          : null,
      ].filter((item): item is string => Boolean(item)),
    };
  });
}
