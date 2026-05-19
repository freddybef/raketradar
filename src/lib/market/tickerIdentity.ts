export type MarketRegion =
  | "Sweden"
  | "Nasdaq US"
  | "Spotlight"
  | "Nordic SME"
  | "First North"
  | "Oslo"
  | "Finland"
  | "Danmark";

export interface CanonicalTickerIdentity {
  ticker: string;
  companyName: string;
  exchange: MarketRegion;
  country: string;
  currency: string;
  isin: string | null;
  sourceConfidence: number;
}

export interface TickerValidationIssue {
  type:
    | "unresolved_symbol"
    | "exchange_conflict"
    | "low_ticker_confidence"
    | "non_swedish_exchange"
    | "ticker_collision"
    | "name_mismatch"
    | "source_mismatch";
  severity: "low" | "medium" | "high";
  message: string;
}

export interface TickerValidationResult {
  identity: CanonicalTickerIdentity;
  displayTicker: string;
  isSwedishPreferred: boolean;
  isDisplayable: boolean;
  isCanonical: boolean;
  rejectionReasons: Array<
    | "unresolved_symbol"
    | "exchange_conflict"
    | "low_ticker_confidence"
    | "non_swedish_exchange"
    | "ticker_collision"
  >;
  issues: TickerValidationIssue[];
  confidenceBreakdown: {
    base: number;
    exchange: number;
    source: number;
    name: number;
    collision: number;
  };
}

const SWEDISH_MARKETS: MarketRegion[] = ["Sweden", "Spotlight", "Nordic SME", "First North", "Oslo", "Finland", "Danmark"];
const MIN_TICKER_CONFIDENCE = 75;

const CANONICAL_IDENTITIES: CanonicalTickerIdentity[] = [
  {
    ticker: "BIOX",
    companyName: "Bioceres Crop Solutions Corp.",
    exchange: "Nasdaq US",
    country: "US",
    currency: "USD",
    isin: "KYG1117K1141",
    sourceConfidence: 96,
  },
  { ticker: "NCC", companyName: "NCC AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: "SE0000117970", sourceConfidence: 92 },
  { ticker: "MOFAST", companyName: "Mofast AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "ELECTROLUX", companyName: "AB Electrolux", exchange: "Sweden", country: "SE", currency: "SEK", isin: "SE0016589188", sourceConfidence: 90 },
  { ticker: "ELUX", companyName: "AB Electrolux", exchange: "Sweden", country: "SE", currency: "SEK", isin: "SE0016589188", sourceConfidence: 88 },
  { ticker: "MANGOLD", companyName: "Mangold AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
  { ticker: "NORDNET", companyName: "Nordnet AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: "SE0015192067", sourceConfidence: 90 },
  { ticker: "LOGISTEA", companyName: "Logistea AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 84 },
  { ticker: "NORDREST", companyName: "Nordrest Holding AB", exchange: "First North", country: "SE", currency: "SEK", isin: null, sourceConfidence: 84 },
  { ticker: "MEDI", companyName: "Medivir AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: "SE0000273294", sourceConfidence: 70 },
  { ticker: "NANO", companyName: "Nordic Nanovector ASA", exchange: "Oslo", country: "NO", currency: "NOK", isin: null, sourceConfidence: 78 },
  { ticker: "EPIS B", companyName: "Episurf Medical AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: "SE0003491562", sourceConfidence: 88 },
  { ticker: "XSPRAY", companyName: "Xspray Pharma AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "CANTA", companyName: "Cantargia AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "VICO", companyName: "Vicore Pharma Holding AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "IMMU", companyName: "Immunovia AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "BICO", companyName: "BICO Group AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
  { ticker: "CAMX", companyName: "Camurus AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 88 },
  { ticker: "VITR", companyName: "Vitrolife AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
  { ticker: "IRLAB A", companyName: "IRLAB Therapeutics AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "HNSA", companyName: "Hansa Biopharma AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
  { ticker: "SAAB B", companyName: "Saab AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 92 },
  { ticker: "MILDEF", companyName: "MilDef Group AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
  { ticker: "CLAV", companyName: "Clavister Holding AB", exchange: "First North", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "GOMX", companyName: "GomSpace Group AB", exchange: "First North", country: "SE", currency: "SEK", isin: null, sourceConfidence: 82 },
  { ticker: "NCAB", companyName: "NCAB Group AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 88 },
  { ticker: "MYCR", companyName: "Mycronic AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 88 },
  { ticker: "HEXATRONIC", companyName: "Hexatronic Group AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 88 },
  { ticker: "VIMIAN", companyName: "Vimian Group AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
  { ticker: "EMBRAC B", companyName: "Embracer Group AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 90 },
  { ticker: "G5EN", companyName: "G5 Entertainment AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 84 },
  { ticker: "VNV", companyName: "VNV Global AB", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 84 },
  { ticker: "KIND SDB", companyName: "Kindred Group plc", exchange: "Sweden", country: "SE", currency: "SEK", isin: null, sourceConfidence: 86 },
];

const COMPANY_ALIASES: Record<string, string> = {
  "ab electrolux": "ELECTROLUX",
  electrolux: "ELECTROLUX",
  "ncc ab": "NCC",
  ncc: "NCC",
  "mofast ab": "MOFAST",
  mofast: "MOFAST",
  "mangold ab": "MANGOLD",
  mangold: "MANGOLD",
  "nordnet ab": "NORDNET",
  nordnet: "NORDNET",
  "logistea ab": "LOGISTEA",
  logistea: "LOGISTEA",
  "nordrest holding ab": "NORDREST",
  nordrest: "NORDREST",
  "medivir ab": "MEDI",
  medivir: "MEDI",
  "bioceres crop solutions": "BIOX",
  "bioceres crop solutions corp": "BIOX",
  "episurf medical": "EPIS B",
  episurf: "EPIS B",
};

function cleanTicker(value: string) {
  return value
    .toUpperCase()
    .replace(/\.(ST|SS|OL|HE|CO)$/i, "")
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\(publ\)/g, "")
    .replace(/\bab\b/g, "")
    .replace(/[^a-z0-9åäöæøüé ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceLooksSwedish(source?: string) {
  const normalized = (source ?? "").toLowerCase();
  return ["fi", "mfn", "cision", "finwire", "placera", "börskollen", "borskollen", "di börs", "redeye", "mangold", "analyst"].some((needle) =>
    normalized.includes(needle)
  );
}

function sourceLooksUs(source?: string) {
  const normalized = (source ?? "").toLowerCase();
  return ["yahoo", "nasdaq us", "reddit", "x/twitter"].some((needle) => normalized.includes(needle));
}

function byTicker(ticker: string) {
  return CANONICAL_IDENTITIES.filter((identity) => identity.ticker === ticker);
}

function byCompanyName(companyName?: string | null) {
  const normalized = normalizeName(companyName);
  if (!normalized) return null;
  const alias = COMPANY_ALIASES[normalized];
  if (alias) return byTicker(alias)[0] ?? null;

  return (
    CANONICAL_IDENTITIES.find((identity) => {
      const canonical = normalizeName(identity.companyName);
      return canonical === normalized || canonical.includes(normalized) || normalized.includes(canonical);
    }) ?? null
  );
}

export function resolveTickerIdentity(input: {
  ticker: string;
  companyName?: string | null;
  source?: string;
  exchangeHint?: MarketRegion;
  swedishFirstMode?: boolean;
}): TickerValidationResult {
  const ticker = cleanTicker(input.ticker);
  const candidates = byTicker(ticker);
  const nameCandidate = byCompanyName(input.companyName);
  const swedishFirstMode = input.swedishFirstMode ?? true;
  const issues: TickerValidationIssue[] = [];
  let selected =
    candidates.find((candidate) => input.exchangeHint && candidate.exchange === input.exchangeHint) ??
    (swedishFirstMode ? candidates.find((candidate) => SWEDISH_MARKETS.includes(candidate.exchange)) : candidates[0]) ??
    nameCandidate ??
    null;

  if (candidates.length > 1) {
    issues.push({
      type: "ticker_collision",
      severity: "high",
      message: `${ticker} finns i flera marknader: ${candidates.map((item) => item.exchange).join(", ")}.`,
    });
  }

  if (nameCandidate && selected && nameCandidate.ticker !== selected.ticker) {
    issues.push({
      type: "name_mismatch",
      severity: "high",
      message: `Bolagsnamnet matchar ${nameCandidate.ticker}, inte ${selected.ticker}.`,
    });
    selected = nameCandidate;
  }

  if (!selected) {
    selected = {
      ticker,
      companyName: input.companyName?.trim() || ticker,
      exchange: "Nasdaq US",
      country: "unknown",
      currency: "unknown",
      isin: null,
      sourceConfidence: 0,
    };
    issues.push({
      type: "unresolved_symbol",
      severity: "high",
      message: `${ticker} saknas i canonical registry och infererades från källa.`,
    });
  }

  const exchangeScore = SWEDISH_MARKETS.includes(selected.exchange)
    ? 12
    : swedishFirstMode
      ? -30
      : 0;
  const sourceScore = sourceLooksSwedish(input.source)
    ? selected.country === "SE"
      ? 10
      : -18
    : sourceLooksUs(input.source) && selected.country !== "SE"
      ? -12
      : 0;
  const normalizedInputName = normalizeName(input.companyName);
  const normalizedSelectedName = normalizeName(selected.companyName);
  const nameScore = !normalizedInputName
    ? 0
    : normalizedSelectedName.includes(normalizedInputName) || normalizedInputName.includes(normalizedSelectedName)
      ? 8
      : -28;
  const collisionScore = candidates.length > 1 ? -16 : 0;

  if (sourceScore <= -12) {
    issues.push({
      type: "exchange_conflict",
      severity: "high",
      message: `${input.source ?? "Okänd källa"} pekar inte mot ${selected.exchange}.`,
    });
  }
  if (nameScore <= -20) {
    issues.push({
      type: "name_mismatch",
      severity: "high",
      message: `Namnet "${input.companyName}" matchar inte ${selected.companyName}.`,
    });
  }

  const confidence = Math.max(
    0,
    Math.min(100, Math.round(selected.sourceConfidence + exchangeScore + sourceScore + nameScore + collisionScore))
  );
  const identity = { ...selected, sourceConfidence: confidence };

  if (!SWEDISH_MARKETS.includes(selected.exchange)) {
    issues.push({
      type: "non_swedish_exchange",
      severity: "high",
      message: `${ticker} är listad på ${selected.exchange} och blockeras i Swedish-first War Room.`,
    });
  }

  if (confidence < MIN_TICKER_CONFIDENCE) {
    issues.push({
      type: "low_ticker_confidence",
      severity: "high",
      message: `${ticker} har låg ticker-confidence (${confidence}/100).`,
    });
  }
  const rejectionReasons = [
    ...new Set(
      issues
        .map((issue) => {
          if (issue.type === "name_mismatch" || issue.type === "source_mismatch") return null;
          return issue.type;
        })
        .filter(
          (
            reason
          ): reason is
            | "unresolved_symbol"
            | "exchange_conflict"
            | "low_ticker_confidence"
            | "non_swedish_exchange"
            | "ticker_collision" => Boolean(reason)
        )
    ),
  ];

  return {
    identity,
    displayTicker: `${identity.ticker} (${identity.exchange})`,
    isSwedishPreferred: SWEDISH_MARKETS.includes(identity.exchange),
    isCanonical: candidates.length > 0 || Boolean(nameCandidate),
    isDisplayable:
      rejectionReasons.length === 0 &&
      confidence >= MIN_TICKER_CONFIDENCE &&
      (candidates.length > 0 || Boolean(nameCandidate)) &&
      (!swedishFirstMode || SWEDISH_MARKETS.includes(identity.exchange)),
    rejectionReasons,
    issues,
    confidenceBreakdown: {
      base: selected.sourceConfidence,
      exchange: exchangeScore,
      source: sourceScore,
      name: nameScore,
      collision: collisionScore,
    },
  };
}

export function validateTickers(
  inputs: Array<{ ticker: string; companyName?: string | null; source?: string }>,
  swedishFirstMode = true
) {
  return inputs.map((input) => resolveTickerIdentity({ ...input, swedishFirstMode }));
}
