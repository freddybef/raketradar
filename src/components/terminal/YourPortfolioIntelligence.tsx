"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import {
  deletePortfolioHolding,
  getPortfolioHoldings,
  type PortfolioHolding,
  savePortfolioHoldingByTickerOrIsin,
  upsertPortfolioHolding,
} from "@/lib/portfolioHoldings";
import {
  deleteManualWatchlistItem,
  getManualWatchlistItems,
  type ManualWatchlistItem,
  upsertManualWatchlistItem,
} from "@/lib/portfolioWatchlist";
import {
  buildPortfolioIntelligence,
  type PortfolioHoldingIntelligence,
  type PortfolioSignalContext,
} from "@/lib/portfolio/portfolioIntelligence";
import { parseAvanzaCsv, type AvanzaImportPreview } from "@/lib/portfolio/avanzaCsv";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { TerminalSetup } from "@/components/terminal/types";

type StrategyBucket = PortfolioHolding["strategy_bucket"];

interface HoldingFormState {
  ticker: string;
  companyName: string;
  exchange: string;
  avgEntry: string;
  size: string;
  conviction: string;
  strategyBucket: StrategyBucket;
  notes: string;
}

const emptyForm: HoldingFormState = {
  ticker: "",
  companyName: "",
  exchange: "Sweden",
  avgEntry: "",
  size: "",
  conviction: "50",
  strategyBucket: "swing",
  notes: "",
};

function toSignalContext(setup: TerminalSetup): PortfolioSignalContext {
  return {
    ticker: setup.ticker,
    companyName: setup.companyName,
    exchange: setup.exchange,
    preOpenScore: setup.preOpenScore,
    confidence: setup.confidence,
    falsePositiveRisk: setup.falsePositiveRisk,
    avgContinuation: setup.avgContinuation,
    avgFadeRisk: setup.avgFadeRisk,
    adaptiveConfidenceDelta: setup.adaptiveConfidenceDelta,
    openingAction: setup.openingAction,
    trigger: setup.trigger,
    catalyst: setup.catalyst,
    tags: setup.tags,
    risk: setup.risk,
    liveMarketReaction: setup.liveMarketReaction,
  };
}

export function YourPortfolioIntelligence({ setups }: { setups: TerminalSetup[] }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<ManualWatchlistItem[]>([]);
  const [form, setForm] = useState<HoldingFormState>(emptyForm);
  const [csvPreview, setCsvPreview] = useState<AvanzaImportPreview | null>(null);
  const [importStatus, setImportStatus] = useState("Ingen CSV vald");
  const [lastImportResult, setLastImportResult] = useState<{
    userId: string | null;
    imported: number;
    updated: number;
    failed: number;
    ignored: number;
    blocked: number;
    fetchedAfterImport: number;
    errorMessage: string | null;
  } | null>(null);
  const [status, setStatus] = useState("Laddar portfolj...");
  const [isSaving, setIsSaving] = useState(false);

  const loadPortfolio = useCallback(async () => {
    const { data } = await getSession();
    const nextUserId = data.session?.user.id ?? null;
    setUserId(nextUserId);

    if (!nextUserId) {
      setHoldings([]);
      setWatchlistItems([]);
      setStatus("Logga in for att spara personlig portfolj.");
      return;
    }

    const [holdingsResult, watchlistResult] = await Promise.all([getPortfolioHoldings(nextUserId), getManualWatchlistItems(nextUserId)]);
    if (holdingsResult.error) {
      setStatus(`Portfolj kunde inte laddas: ${holdingsResult.error.message}`);
      setHoldings([]);
      return;
    }

    setHoldings(holdingsResult.data ?? []);
    setWatchlistItems(watchlistResult.data ?? []);
    setStatus(`${holdingsResult.data?.length ?? 0} innehav · ${watchlistResult.data?.length ?? 0} bevakningar`);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadPortfolio();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [loadPortfolio]);

  const report = useMemo(
    () =>
      buildPortfolioIntelligence({
        holdings,
        marketSetups: setups.map(toSignalContext),
      }),
    [holdings, setups]
  );
  const shouldCollapseHoldings = report.holdings.length > 8;

  async function saveHolding() {
    if (!userId || form.ticker.trim().length === 0) return;
    setIsSaving(true);
    const { error } = await upsertPortfolioHolding({
      user_id: userId,
      ticker: form.ticker,
      company_name: form.companyName.trim() || null,
      exchange: form.exchange.trim() || "Sweden",
      avg_entry: Number(form.avgEntry || 0),
      size: Number(form.size || 0),
      conviction: Number(form.conviction || 50),
      strategy_bucket: form.strategyBucket,
      notes: form.notes.trim() || null,
    });
    setIsSaving(false);

    if (error) {
      setStatus(`Kunde inte spara: ${error.message}`);
      return;
    }

    setForm(emptyForm);
    await loadPortfolio();
  }

  async function handleCsvFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    const preview = parseAvanzaCsv(text);
    setCsvPreview(preview);
    setImportStatus(
      `Preview: ${preview.accepted.length} validerade, ${preview.ignored.length} ignorerade, ${preview.blocked.length} blockerade`
    );
  }

  async function importCsvPreview() {
    if (!userId) {
      setImportStatus("Logga in for att spara portfolj. Importen stoppades utan Supabase-save.");
      setLastImportResult({
        userId: null,
        imported: 0,
        updated: 0,
        failed: 0,
        ignored: csvPreview?.ignored.length ?? 0,
        blocked: csvPreview?.blocked.length ?? 0,
        fetchedAfterImport: holdings.length,
        errorMessage: "No authenticated user session",
      });
      return;
    }
    if (!csvPreview) return;

    setImportStatus(`Importerar ${csvPreview.accepted.length} validerade innehav...`);
    setIsSaving(true);
    let imported = 0;
    let updated = 0;
    let failed = 0;
    let firstError: string | null = null;
    const savedRows: PortfolioHolding[] = [];

    for (const row of csvPreview.accepted) {
      const result = await savePortfolioHoldingByTickerOrIsin({
        user_id: userId,
        ticker: row.ticker,
        company_name: row.name,
        exchange: row.exchange,
        source_market: row.sourceMarket,
        isin: row.isin,
        currency: row.currency ?? "SEK",
        country: row.country,
        avg_entry: row.avgEntry,
        size: row.size,
        conviction: 50,
        strategy_bucket: "swing",
        notes: "Importerad fran Avanza CSV",
      });
      if (result.error || !result.data) {
        failed += 1;
        firstError ??= result.error?.message ?? `Okant Supabase-fel for ${row.ticker}`;
      } else {
        savedRows.push(result.data);
        if (result.action === "inserted") imported += 1;
        else updated += 1;
      }
    }

    setIsSaving(false);
    const refreshed = await getPortfolioHoldings(userId);
    const nextHoldings = refreshed.data ?? savedRows;
    setHoldings(nextHoldings);
    setLastImportResult({
      userId,
      imported,
      updated,
      failed,
      ignored: csvPreview.ignored.length,
      blocked: csvPreview.blocked.length,
      fetchedAfterImport: nextHoldings.length,
      errorMessage: firstError ?? refreshed.error?.message ?? null,
    });
    setImportStatus(
      firstError
        ? `Import klar med fel: ${imported} importerade, ${updated} uppdaterade, ${failed} misslyckade. ${firstError}`
        : `Import klar: ${imported} importerade, ${updated} uppdaterade, ${csvPreview.ignored.length} ignorerade, ${csvPreview.blocked.length} blockerade`
    );
    if (!firstError && failed === 0) setCsvPreview(null);
  }

  async function saveWatchlistItem() {
    if (!userId || form.ticker.trim().length === 0) return;
    setIsSaving(true);
    const { error } = await upsertManualWatchlistItem({
      userId,
      ticker: form.ticker,
      companyName: form.companyName,
      market: form.exchange,
      notes: form.notes,
    });
    setIsSaving(false);

    if (error) {
      setStatus(`Kunde inte spara bevakning: ${error.message}`);
      return;
    }

    setForm(emptyForm);
    await loadPortfolio();
  }

  async function removeHolding(id: string) {
    const { error } = await deletePortfolioHolding(id);
    if (error) {
      setStatus(`Kunde inte ta bort: ${error.message}`);
      return;
    }
    await loadPortfolio();
  }

  async function removeWatchlistItem(id: string) {
    const { error } = await deleteManualWatchlistItem(id);
    if (error) {
      setStatus(`Kunde inte ta bort bevakning: ${error.message}`);
      return;
    }
    await loadPortfolio();
  }

  return (
    <TerminalPanel title="Your Portfolio Intelligence" eyebrow="holdings-aware decisions" action={<SignalPill tone={userId ? "good" : "warn"}>{status}</SignalPill>}>
      <div className="grid gap-4">
        <MorningChecklist items={report.checklist} />

        {!userId ? (
          <EmptyTerminalState title="Ingen inloggad portfolj" body="Terminalen visar inga fake holdings. Logga in via appen for att spara innehav med Supabase RLS." />
        ) : (
          <details className="border border-zinc-800 bg-black/20 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Lagg till/importera innehav</summary>
            <div className="mt-3">
              <HoldingEditor
                form={form}
                setForm={setForm}
                onSave={() => void saveHolding()}
                onWatchlistSave={() => void saveWatchlistItem()}
                isSaving={isSaving}
              />
            </div>
          </details>
        )}
        {userId && (
          <details className="border border-zinc-800 bg-black/20 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Avanza CSV / import-debug</summary>
            <div className="mt-3">
              <AvanzaCsvImport
                preview={csvPreview}
                status={importStatus}
                isSaving={isSaving}
                onFile={(file) => void handleCsvFile(file)}
                onImport={() => void importCsvPreview()}
                userId={userId}
                holdingsFetchedCount={holdings.length}
                lastImportResult={lastImportResult}
              />
            </div>
          </details>
        )}

        {holdings.length === 0 ? (
          <EmptyTerminalState
            title="Inga riktiga innehav sparade"
            body="Lagg till ticker, snittingang och storlek for att fa portfoljrelativa beslut. Terminalen skapar inga exempelpositioner."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <PortfolioSummary report={report} watchlistItems={watchlistItems} onRemoveWatchlist={(id) => void removeWatchlistItem(id)} />
            <details className="border border-zinc-800 bg-black/20 p-3" open={!shouldCollapseHoldings}>
              <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Visa alla innehav ({report.holdings.length})</summary>
              <div className="mt-3">
                <HoldingsDecisionList holdings={report.holdings} onRemove={(id) => void removeHolding(id)} />
              </div>
            </details>
          </div>
        )}
        {holdings.length === 0 && watchlistItems.length > 0 && (
          <PortfolioSummary report={report} watchlistItems={watchlistItems} onRemoveWatchlist={(id) => void removeWatchlistItem(id)} />
        )}
      </div>
    </TerminalPanel>
  );
}

function AvanzaCsvImport({
  preview,
  status,
  isSaving,
  onFile,
  onImport,
  userId,
  holdingsFetchedCount,
  lastImportResult,
}: {
  preview: AvanzaImportPreview | null;
  status: string;
  isSaving: boolean;
  onFile: (file?: File) => void;
  onImport: () => void;
  userId: string | null;
  holdingsFetchedCount: number;
  lastImportResult: {
    userId: string | null;
    imported: number;
    updated: number;
    failed: number;
    ignored: number;
    blocked: number;
    fetchedAfterImport: number;
    errorMessage: string | null;
  } | null;
}) {
  return (
    <div className="grid gap-3 border border-zinc-800 bg-black/20 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-200">Avanza CSV Import</p>
          <p className="text-xs text-zinc-500">Importerar endast Typ=STOCK. Fonder ignoreras. Osakra tickers blockeras.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => onFile(event.target.files?.[0])}
            className="text-xs text-zinc-400 file:mr-3 file:border file:border-zinc-700 file:bg-zinc-950 file:px-3 file:py-2 file:text-zinc-200"
          />
          <button
            type="button"
            onClick={onImport}
            disabled={isSaving || !preview || preview.accepted.length === 0}
            className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 disabled:opacity-40"
          >
            Importera validerade
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">{status}</p>
      <div className="grid gap-2 border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400 md:grid-cols-4">
        <span>current user: {userId ? `${userId.slice(0, 8)}...` : "ej inloggad"}</span>
        <span>holdings fetched: {holdingsFetchedCount}</span>
        <span>
          last import:{" "}
          {lastImportResult
            ? `${lastImportResult.imported} imported / ${lastImportResult.updated} updated / ${lastImportResult.failed} failed`
            : "-"}
        </span>
        <span className={lastImportResult?.errorMessage ? "text-red-300" : "text-zinc-500"}>
          error: {lastImportResult?.errorMessage ?? "-"}
        </span>
      </div>
      {preview && (
        <div className="grid gap-3 xl:grid-cols-3">
          <ImportBucket
            title="Validerade"
            tone="good"
            rows={preview.accepted.map(
              (row) =>
                `${row.ticker} · ${row.canonicalExchange} · ${row.confidenceLevel} ${row.tickerConfidence} · ${row.reason} · ISIN ${row.isinMatch ? "match" : "-"} · market ${row.marketMatch ? "match" : "-"}`
            )}
          />
          <ImportBucket title="Ignorerade" tone="neutral" rows={preview.ignored.map((row) => `${row.ticker || row.name}: ${row.reason}`)} />
          <ImportBucket
            title="Blockerade"
            tone="risk"
            rows={preview.blocked.map(
              (row) =>
                `${row.ticker || row.name}: ${row.reason} · resolved ${row.canonicalTicker ?? "-"} · ${row.canonicalExchange ?? "-"} · ${row.confidenceLevel} ${row.tickerConfidence} · ISIN ${row.isinMatch ? "match" : "-"} · market ${row.marketMatch ? "match" : "-"}`
            )}
          />
        </div>
      )}
    </div>
  );
}

function ImportBucket({ title, tone, rows }: { title: string; tone: "good" | "neutral" | "risk"; rows: string[] }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
        <SignalPill tone={tone}>{rows.length}</SignalPill>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Inga rader.</p>
      ) : (
        <div className="grid max-h-36 gap-1 overflow-auto">
          {rows.slice(0, 20).map((row, index) => (
            <p key={`${title}-${row}-${index}`} className="text-xs text-zinc-300">
              {row}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingEditor({
  form,
  setForm,
  onSave,
  onWatchlistSave,
  isSaving,
}: {
  form: HoldingFormState;
  setForm: (form: HoldingFormState) => void;
  onSave: () => void;
  onWatchlistSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border border-zinc-800 bg-black/20 p-3 text-sm md:grid-cols-[6rem_1fr_6rem_6rem_6rem_8rem_1fr_6rem_7rem]">
      <Input label="Ticker" value={form.ticker} onChange={(value) => setForm({ ...form, ticker: value.toUpperCase() })} />
      <Input label="Bolag" value={form.companyName} onChange={(value) => setForm({ ...form, companyName: value })} />
      <Input label="Entry" value={form.avgEntry} onChange={(value) => setForm({ ...form, avgEntry: value })} type="number" />
      <Input label="Size" value={form.size} onChange={(value) => setForm({ ...form, size: value })} type="number" />
      <Input label="Conv" value={form.conviction} onChange={(value) => setForm({ ...form, conviction: value })} type="number" />
      <label className="grid gap-1 text-xs text-zinc-500">
        Bucket
        <select
          value={form.strategyBucket}
          onChange={(event) => setForm({ ...form, strategyBucket: event.target.value as StrategyBucket })}
          className="border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
        >
          <option value="core">core</option>
          <option value="swing">swing</option>
          <option value="speculative">speculative</option>
          <option value="event-driven">event-driven</option>
        </select>
      </label>
      <Input label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || form.ticker.trim().length === 0}
        className="self-end border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 disabled:opacity-40"
      >
        {isSaving ? "Sparar" : "Holding"}
      </button>
      <button
        type="button"
        onClick={onWatchlistSave}
        disabled={isSaving || form.ticker.trim().length === 0}
        className="self-end border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 disabled:opacity-40"
      >
        Bevakning
      </button>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="grid gap-1 text-xs text-zinc-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
      />
    </label>
  );
}

function MorningChecklist({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2 border border-zinc-800 bg-black/20 p-3 md:grid-cols-5">
      {items.map((item, index) => (
        <p key={`${item}-${index}-portfolio-check`} className="text-sm text-zinc-300">
          {item}
        </p>
      ))}
    </div>
  );
}

function HoldingsDecisionList({
  holdings,
  onRemove,
}: {
  holdings: PortfolioHoldingIntelligence[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {holdings.map((item) => (
        <article key={`${item.holding.id}-${item.holding.ticker}-holding-intelligence`} className="border border-zinc-800 bg-black/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono font-semibold text-zinc-100">
                {item.holding.ticker} <span className="font-sans text-xs text-zinc-500">{item.holding.exchange}</span>
              </p>
              <p className="text-xs text-zinc-500">{item.holding.company_name ?? "Bolagsnamn saknas"} · {item.holding.strategy_bucket}</p>
            </div>
            <SignalPill tone={toneForStatus(item.status)}>{item.statusLabel}</SignalPill>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{item.decision}</p>
          <p className="mt-1 text-xs text-zinc-500">{item.reason}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 md:grid-cols-6">
            <span>Entry {item.holding.avg_entry}</span>
            <span>Size {item.holding.size}</span>
            <span>Delta {item.deltaVsEntry === null ? "-" : `${item.deltaVsEntry}%`}</span>
            <span>Cont {item.continuationProbability}%</span>
            <span>Fade {item.fadeRisk}%</span>
            <span>FP {item.crowdingRisk}%</span>
          </div>
          <button type="button" onClick={() => onRemove(item.holding.id)} className="mt-3 text-xs text-red-300 hover:text-red-200">
            Ta bort innehav
          </button>
        </article>
      ))}
    </div>
  );
}

function PortfolioSummary({
  report,
  watchlistItems,
  onRemoveWatchlist,
}: {
  report: ReturnType<typeof buildPortfolioIntelligence>;
  watchlistItems: ManualWatchlistItem[];
  onRemoveWatchlist: (id: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <MiniBucket title="Starkande innehav" items={report.strongestHoldings.map((item) => `${item.holding.ticker}: ${item.decision}`)} />
      <MiniBucket title="Trimma / salj / bevaka" items={report.weakeningHoldings.map((item) => `${item.holding.ticker}: ${item.decision}`)} />
      <MiniBucket title="Re-entry / jaga inte" items={report.riskWarnings.map((item) => `${item.holding.ticker}: fade ${item.fadeRisk}% / crowding ${item.crowdingRisk}%`)} />
      <MiniBucket title="Suggested rotations" items={report.suggestedRotations.map((item) => `${item.weakeningHolding} -> ${item.suggestedAlternative}: ${item.why}`)} />
      <MiniBucket title="Concentration risk" items={report.concentrationRisk} />
      <WatchlistBucket items={watchlistItems} onRemove={onRemoveWatchlist} />
    </div>
  );
}

function WatchlistBucket({ items, onRemove }: { items: ManualWatchlistItem[]; onRemove: (id: string) => void }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Manual watchlist</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Ingen manuell bevakning.</p>
      ) : (
        <div className="grid gap-2">
          {items.map((item, index) => (
            <div key={`${item.id}-${item.ticker}-${index}-watchlist`} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-mono text-zinc-300">{item.ticker}</span>
              <button type="button" onClick={() => onRemove(item.id)} className="text-xs text-red-300">
                ta bort
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBucket({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Ingen signal.</p>
      ) : (
        <div className="grid gap-1">
          {items.slice(0, 4).map((item, index) => (
            <p key={`${title}-${item}-${index}`} className="text-sm text-zinc-300">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function toneForStatus(status: PortfolioHoldingIntelligence["status"]): "good" | "warn" | "risk" | "neutral" {
  if (status === "STRENGTHENING" || status === "ACCUMULATING") return "good";
  if (status === "REDUCE" || status === "HIGH_RISK" || status === "EXIT_WATCH") return "risk";
  if (status === "AVOID_ADDING") return "warn";
  return "neutral";
}
