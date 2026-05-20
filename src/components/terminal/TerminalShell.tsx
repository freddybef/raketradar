"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentLoopReport,
  AutonomyStatusReport,
  AutonomousDiscoveryReport,
  IntelligenceChangesReport,
  LearningReport,
  OvernightSummaryReport,
  SuspiciousUnknownsReport,
  TerminalDebug,
  TerminalWarRoom,
} from "@/components/terminal/types";
import { AgentAlertsPanel } from "@/components/terminal/AgentAlertsPanel";
import { AutonomyPanel, type AutonomyPreset } from "@/components/terminal/AutonomyPanel";
import { ActionBoard, DecisionSummary } from "@/components/terminal/ActionBoard";
import { AutonomousDiscoveryPanel } from "@/components/terminal/AutonomousDiscoveryPanel";
import { CaseDrawer, type TerminalCase } from "@/components/terminal/CaseDrawer";
import { CopilotPanel } from "@/components/terminal/CopilotPanel";
import { buildCaseSummary, type TerminalCaseSummary } from "@/components/terminal/caseSummary";
import { DailyPlanPanel } from "@/components/terminal/DailyPlanPanel";
import { mergeWarRoomAndDiscovery } from "@/components/terminal/candidateMerge";
import { buildDecisionBoard, isActionableSetup } from "@/components/terminal/decision";
import { FeedHealthPanel } from "@/components/terminal/FeedHealthPanel";
import { LiveEdgeBoard } from "@/components/terminal/LiveEdgeBoard";
import { LiveMarketPressurePanel } from "@/components/terminal/LiveMarketPressurePanel";
import { MarketRegimePanel } from "@/components/terminal/MarketRegimePanel";
import { OutcomeLearningPanel } from "@/components/terminal/OutcomeLearningPanel";
import { PortfolioModePanel } from "@/components/terminal/PortfolioModePanel";
import { SuspiciousUnknownsPanel } from "@/components/terminal/SuspiciousUnknownsPanel";
import { TopSetupsPanel } from "@/components/terminal/TopSetupsPanel";
import { WarRoomLivePanel } from "@/components/terminal/WarRoomLivePanel";
import { WhatChangedPanel } from "@/components/terminal/WhatChangedPanel";
import { YourPortfolioIntelligence } from "@/components/terminal/YourPortfolioIntelligence";

type LoadState = "loading" | "ready" | "error";
type RunReason = "manual" | "scheduled" | "market-open" | "feedback" | "intraday" | "evening" | "overnight";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json() as Promise<T>;
}

function time(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TerminalShell() {
  const [state, setState] = useState<LoadState>("loading");
  const [warRoom, setWarRoom] = useState<TerminalWarRoom | null>(null);
  const [learning, setLearning] = useState<LearningReport | null>(null);
  const [debug, setDebug] = useState<TerminalDebug | null>(null);
  const [discovery, setDiscovery] = useState<AutonomousDiscoveryReport | null>(null);
  const [manualDiscoveryTickers, setManualDiscoveryTickers] = useState("");
  const [manualDiscoveryInput, setManualDiscoveryInput] = useState("");
  const [agent, setAgent] = useState<AgentLoopReport | null>(null);
  const [changes, setChanges] = useState<IntelligenceChangesReport | null>(null);
  const [suspiciousUnknowns, setSuspiciousUnknowns] = useState<SuspiciousUnknownsReport | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<"off" | "30s" | "60s" | "5m">("off");
  const [autonomyPreset, setAutonomyPreset] = useState<AutonomyPreset>("off");
  const [autonomyStatusReport, setAutonomyStatusReport] = useState<AutonomyStatusReport | null>(null);
  const [autonomyStatus, setAutonomyStatus] = useState("Autonomy ar av.");
  const [overnightSummary, setOvernightSummary] = useState<OvernightSummaryReport | null>(null);
  const [runnerStatus, setRunnerStatus] = useState("Ingen scan kord");
  const [collectorStatus, setCollectorStatus] = useState("Redo");
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<TerminalCase | null>(null);
  const [recentImportantCases, setRecentImportantCases] = useState<TerminalCaseSummary[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("raketradar_recent_important_cases");
      return stored ? (JSON.parse(stored) as TerminalCaseSummary[]) : [];
    } catch {
      return [];
    }
  });

  const load = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const [warRoomPayload, learningPayload, debugPayload, discoveryPayload, agentPayload, changesPayload, autonomyPayload, suspiciousPayload] = await Promise.all([
        fetchJson<TerminalWarRoom>("/api/intelligence/morning-war-room"),
        fetchJson<LearningReport>("/api/outcomes/learning"),
        fetchJson<TerminalDebug>("/api/intelligence/debug"),
        fetchJson<AutonomousDiscoveryReport>(
          `/api/intelligence/autonomous-discovery${manualDiscoveryTickers.trim() ? `?extra=${encodeURIComponent(manualDiscoveryTickers)}` : ""}`
        ),
        fetchJson<AgentLoopReport>("/api/agent-loop"),
        fetchJson<IntelligenceChangesReport>("/api/intelligence/changes"),
        fetchJson<AutonomyStatusReport>("/api/intelligence/autonomy/status"),
        fetchJson<SuspiciousUnknownsReport>("/api/intelligence/suspicious-unknowns"),
      ]);

      setWarRoom(warRoomPayload);
      setLearning(learningPayload);
      setDebug(debugPayload);
      setDiscovery(discoveryPayload);
      setAgent(agentPayload);
      setChanges(changesPayload);
      setAutonomyStatusReport(autonomyPayload);
      setSuspiciousUnknowns(suspiciousPayload);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Okant fel");
      setState("error");
    }
  }, [manualDiscoveryTickers]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const topSetups = useMemo(() => mergeWarRoomAndDiscovery(warRoom, discovery), [warRoom, discovery]);
  const mergedWarRoom = useMemo<TerminalWarRoom | null>(() => {
    if (warRoom) {
      return {
        ...warRoom,
        topPreOpenSetups: topSetups,
        acceptedCount: topSetups.length,
      };
    }
    if (topSetups.length === 0) return null;
    return {
      generatedAt: discovery?.generatedAt ?? new Date().toISOString(),
      topPreOpenSetups: topSetups,
      rejectedCandidates: [],
      acceptedCount: topSetups.length,
      rejectedCount: 0,
      feedStatus: {
        status: "missing",
        message: "War Room saknas. Visar promoted Autonomous Discovery.",
        latestNewsFetch: null,
        acceptedNews: 0,
        rejectedNews: 0,
      },
    };
  }, [warRoom, topSetups, discovery?.generatedAt]);
  const decisions = useMemo(() => buildDecisionBoard(mergedWarRoom), [mergedWarRoom]);
  const focusTicker = topSetups[0]?.ticker ?? "-";
  const actionableCount = topSetups.filter(isActionableSetup).length;
  const currentCaseSummaries = useMemo(() => topSetups.slice(0, 10).map((setup) => buildCaseSummary(setup)), [topSetups]);

  useEffect(() => {
    const important = currentCaseSummaries.filter((item) => item.action === "Agera" || item.action === "Het men jaga inte" || item.score >= 65);
    if (important.length === 0) return;
    const handle = window.setTimeout(() => {
      setRecentImportantCases((previous) => {
        const merged = new Map<string, TerminalCaseSummary>();
        [...important, ...previous].forEach((item) => merged.set(item.ticker, item));
        const next = [...merged.values()].slice(0, 20);
        try {
          window.localStorage.setItem("raketradar_recent_important_cases", JSON.stringify(next));
        } catch {
          // Local memory is best-effort; live terminal state remains source of truth.
        }
        return next;
      });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [currentCaseSummaries]);

  const fastCopilotContext = useMemo(() => ({
    focusTicker,
    actionCount: actionableCount,
    topSetups: currentCaseSummaries,
    recentImportantCases,
    latestChange: changes?.changes?.[0] ? `${changes.changes[0].ticker}: ${changes.changes[0].reason}` : null,
    providerStatus: discovery?.providerStatus ? `${discovery.providerStatus.status}: ${discovery.liveHits}/${discovery.universeSize} live` : null,
  }), [focusTicker, actionableCount, currentCaseSummaries, recentImportantCases, changes, discovery]);

  async function runCollector() {
    setCollectorStatus("Kor collector...");
    try {
      const response = await fetch("/api/outcomes/collect", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setCollectorStatus(response.status === 401 ? "Collector ar skyddad av server-secret/cron" : `Collector fel ${response.status}`);
        return;
      }
      const payload = (await response.json()) as { processed: number; updated: number };
      setCollectorStatus(`Collector: ${payload.updated}/${payload.processed} uppdaterade`);
      await load();
    } catch {
      setCollectorStatus("Collector kunde inte koras fran terminalen");
    }
  }

  const runScan = useCallback(async (
    reason: RunReason = "manual",
    jobs = ["marketReaction", "discovery", "warRoom", "agentLoop", "health"]
  ) => {
    setRunnerStatus("Kor scan...");
    try {
      const response = await fetch("/api/intelligence/run", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        generatedAt?: string;
        status?: string;
        failedJobs?: unknown[];
        changes?: unknown[];
        error?: string;
        saved?: { learningObservations?: number };
      };
      if (!response.ok) {
        setRunnerStatus(payload.error ?? `Runner fel ${response.status}`);
        return null;
      }
      setRunnerStatus(`Scan klar: ${payload.status ?? "ok"} / changes ${payload.changes?.length ?? 0} / failed ${payload.failedJobs?.length ?? 0}`);
      await load();
      return payload;
    } catch (scanError) {
      setRunnerStatus(scanError instanceof Error ? scanError.message : "Runner kunde inte koras");
      return null;
    }
  }, [load]);

  useEffect(() => {
    if (autoRefresh === "off") return;
    const ms = autoRefresh === "30s" ? 30000 : autoRefresh === "60s" ? 60000 : 300000;
    const handle = window.setInterval(() => {
      void runScan("scheduled");
    }, ms);
    return () => window.clearInterval(handle);
  }, [autoRefresh, runScan]);

  useEffect(() => {
    if (autonomyStatusReport?.status !== "running") return;
    const handle = window.setInterval(async () => {
      try {
        const status = await fetchJson<AutonomyStatusReport>("/api/intelligence/autonomy/status");
        setAutonomyStatusReport(status);
      } catch {
        setAutonomyStatus("Kunde inte hamta autonomy-status.");
      }
    }, 30_000);
    return () => window.clearInterval(handle);
  }, [autonomyStatusReport?.status]);

  async function generateSummary() {
    setAutonomyStatus("Hamtar overnight-summary...");
    try {
      const summary = await fetchJson<OvernightSummaryReport>("/api/intelligence/autonomy/overnight-summary");
      setOvernightSummary(summary);
      setAutonomyStatus(`Summary klar: ${summary.morningBrief.focus_now.length} focus, ${summary.dataCoverageIssues.length} data warnings.`);
    } catch (summaryError) {
      setAutonomyStatus(summaryError instanceof Error ? summaryError.message : "Kunde inte hamta overnight-summary");
    }
  }

  async function startAutonomy() {
    if (autonomyPreset === "off") {
      setAutonomyStatus("Valj market-open, intraday, evening eller overnight innan start.");
      return;
    }
    setAutonomyStatus("Startar autonomy...");
    try {
      const response = await fetch("/api/intelligence/autonomy/start", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: autonomyPreset, runImmediately: true }),
      });
      const payload = (await response.json()) as AutonomyStatusReport & { error?: string };
      if (!response.ok) {
        setAutonomyStatus(payload.error ?? `Autonomy start fel ${response.status}`);
        return;
      }
      setAutonomyStatusReport(payload);
      setAutonomyStatus("Autonomy startad. Den kor pa servern medan Next.js-processen ar igang.");
      await load();
    } catch (startError) {
      setAutonomyStatus(startError instanceof Error ? startError.message : "Autonomy kunde inte startas");
    }
  }

  async function stopAutonomyMode() {
    setAutonomyStatus("Stoppar autonomy...");
    try {
      const response = await fetch("/api/intelligence/autonomy/stop", { method: "POST", cache: "no-store" });
      const payload = (await response.json()) as AutonomyStatusReport & { error?: string };
      if (!response.ok) {
        setAutonomyStatus(payload.error ?? `Autonomy stop fel ${response.status}`);
        return;
      }
      setAutonomyStatusReport(payload);
      setAutonomyStatus("Autonomy stoppad sakert.");
    } catch (stopError) {
      setAutonomyStatus(stopError instanceof Error ? stopError.message : "Autonomy kunde inte stoppas");
    }
  }

  async function runLearningHarvestNow() {
    setAutonomyStatus("Kor learning harvest...");
    try {
      const response = await fetch("/api/intelligence/autonomy/harvest", { method: "POST", cache: "no-store" });
      const payload = (await response.json()) as { saved?: number; created?: number; error?: string };
      if (!response.ok) {
        setAutonomyStatus(payload.error ?? `Harvest fel ${response.status}`);
        return;
      }
      setAutonomyStatus(`Harvest klar: ${payload.saved ?? 0}/${payload.created ?? 0} observationer sparade.`);
      await load();
    } catch (harvestError) {
      setAutonomyStatus(harvestError instanceof Error ? harvestError.message : "Learning harvest kunde inte koras");
    }
  }

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="sticky top-0 z-30 border-b border-zinc-800 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-[1500px] px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-300">RaketRadar Core Terminal</p>
              <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">Pre-open edge board</h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs md:flex md:items-center">
              <Metric label="Focus" value={focusTicker} />
              <Metric label="Agera nu" value={String(actionableCount)} />
              <Metric label="Accepted" value={String(mergedWarRoom?.acceptedCount ?? 0)} />
              <Metric label="Rejected" value={String(warRoom?.rejectedCount ?? 0)} />
              <Metric label="Updated" value={time(warRoom?.generatedAt)} />
              <button type="button" onClick={() => void runScan("manual")} className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 hover:border-emerald-500/60">
                Run scan now
              </button>
              <button type="button" onClick={() => void runCollector()} className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 hover:border-yellow-500/60">
                Collect outcomes
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{collectorStatus}</span>
            <span>{runnerStatus}</span>
            <label className="flex items-center gap-2">
              Auto-refresh:
              <select value={autoRefresh} onChange={(event) => setAutoRefresh(event.target.value as typeof autoRefresh)} className="border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-200">
                <option value="off">off</option>
                <option value="30s">30s</option>
                <option value="60s">60s</option>
                <option value="5m">5m</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-6">
        {state === "loading" && <TerminalState title="Laddar live intelligence" body="Hamtar Morning War Room, outcome learning och provider health." />}
        {state === "error" && <TerminalState title="Terminalen kunde inte ladda" body={error ?? "Kontrollera dev-server och Supabase-env."} tone="error" />}

        {state === "ready" && (
          <div className="grid gap-5">
            <DailyPlanPanel setups={topSetups} decisions={decisions} discovery={discovery} warRoom={mergedWarRoom} changes={changes} />
            <LiveEdgeBoard setups={topSetups} decisions={decisions} changes={changes} onSelect={(setup) => setSelectedCase({ type: "setup", setup })} />
            <YourPortfolioIntelligence setups={topSetups} />
            <WhatChangedPanel changes={changes} />
            <CopilotPanel
              selectedTicker={selectedCase?.type === "setup" ? selectedCase.setup.ticker : selectedCase?.type === "discovery" ? selectedCase.candidate.ticker : null}
              fastContext={fastCopilotContext}
            />

            <details className="border border-zinc-800 bg-zinc-950/95 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Detailed panels / debug</summary>
              <div className="mt-4 grid gap-5">
                <ActionBoard decisions={decisions} onSelect={(decision) => setSelectedCase({ type: "decision", decision })} />
                <AutonomousDiscoveryPanel
                  discovery={discovery}
                  manualTickers={manualDiscoveryInput}
                  onManualTickersChange={setManualDiscoveryInput}
                  onRescan={() => {
                    setManualDiscoveryTickers(manualDiscoveryInput);
                  }}
                  onSelect={(candidate) => setSelectedCase({ type: "discovery", candidate })}
                />
                <LiveMarketPressurePanel setups={topSetups} />
                <TopSetupsPanel setups={topSetups} onSelect={(setup) => setSelectedCase({ type: "setup", setup })} />
                <DecisionSummary decisions={decisions} warRoom={mergedWarRoom} learning={learning} debug={debug} />
                <AutonomyPanel
                  preset={autonomyPreset}
                  onPresetChange={setAutonomyPreset}
                  status={autonomyStatusReport}
                  statusText={autonomyStatus}
                  summary={overnightSummary}
                  onStart={() => void startAutonomy()}
                  onStop={() => void stopAutonomyMode()}
                  onRunHarvest={() => void runLearningHarvestNow()}
                  onGenerateSummary={() => void generateSummary()}
                />
                <AgentAlertsPanel agent={agent} />
                <SuspiciousUnknownsPanel report={suspiciousUnknowns} />
              </div>
            </details>
            <details className="border border-zinc-800 bg-zinc-950/95 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Research / learning</summary>
              <div className="mt-4 grid gap-5">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <WarRoomLivePanel warRoom={mergedWarRoom} onRejectedSelect={(rejected) => setSelectedCase({ type: "rejected", rejected })} />
                  <OutcomeLearningPanel learning={learning} debug={debug} />
                </div>
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <MarketRegimePanel warRoom={mergedWarRoom} />
                  <FeedHealthPanel warRoom={mergedWarRoom} debug={debug} />
                </div>
                <PortfolioModePanel setups={topSetups} learning={learning} debug={debug} />
              </div>
            </details>
          </div>
        )}
      </div>
      <CaseDrawer item={selectedCase} agent={agent} onClose={() => setSelectedCase(null)} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6rem] border border-zinc-800 bg-zinc-950 px-3 py-2">
      <p className="text-zinc-500">{label}</p>
      <p className="truncate font-mono text-zinc-100">{value}</p>
    </div>
  );
}

function TerminalState({ title, body, tone = "neutral" }: { title: string; body: string; tone?: "neutral" | "error" }) {
  return (
    <section className={`border p-6 ${tone === "error" ? "border-red-500/30 bg-red-950/20" : "border-zinc-800 bg-zinc-950"}`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-zinc-400">{body}</p>
    </section>
  );
}
