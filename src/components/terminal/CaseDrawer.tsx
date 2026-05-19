"use client";

import type { AgentLoopReport, AutonomousDiscoveryCandidate, TerminalRejectedCandidate, TerminalSetup } from "@/components/terminal/types";
import type { DecisionItem } from "@/components/terminal/decision";
import { buildCaseSummary } from "@/components/terminal/caseSummary";
import { FeedbackButtons } from "@/components/terminal/FeedbackButtons";
import { SignalPill } from "@/components/terminal/TerminalPanel";

export type TerminalCase =
  | { type: "setup"; setup: TerminalSetup }
  | { type: "decision"; decision: DecisionItem }
  | { type: "discovery"; candidate: AutonomousDiscoveryCandidate }
  | { type: "rejected"; rejected: TerminalRejectedCandidate };

export function CaseDrawer({ item, agent, onClose }: { item: TerminalCase | null; agent?: AgentLoopReport | null; onClose: () => void }) {
  if (!item) return null;

  const title =
    item.type === "setup"
      ? item.setup.ticker
      : item.type === "decision"
        ? item.decision.ticker
        : item.type === "discovery"
          ? item.candidate.ticker
          : item.rejected.ticker;
  const company =
    item.type === "setup"
      ? item.setup.companyName
      : item.type === "decision"
        ? item.decision.company
        : item.type === "discovery"
          ? item.candidate.companyName
          : item.rejected.trigger;
  const agentCase = agent?.cases.find((caseItem) => caseItem.ticker === title);
  const timeline = agent?.cases.filter((caseItem) => caseItem.ticker === title) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <aside className="ml-auto h-full w-full max-w-2xl overflow-auto border-l border-zinc-800 bg-[#070708] p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-300">Case details</p>
            <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
            <p className="text-sm text-zinc-500">{company}</p>
          </div>
          <button type="button" onClick={onClose} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
            Stäng
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <FeedbackButtons ticker={title} rawPayload={item} />
          {agentCase?.raw?.suspiciousUnknown ? (
            <div className="border border-yellow-500/20 bg-yellow-950/10 p-3">
              <div className="flex flex-wrap gap-2">
                <SignalPill tone="warn">suspicious unknown</SignalPill>
                <SignalPill tone="warn">weak coverage</SignalPill>
                <SignalPill tone="warn">false negative risk</SignalPill>
              </div>
              <p className="mt-2 text-sm text-zinc-300">Detta är inte en köp-signal. Det är en coverage/entity-varning som kräver verifiering.</p>
            </div>
          ) : null}
          {agentCase && (
            <div className="border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Agent state</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <SignalPill tone={agentCase.state.includes("RISK") || agentCase.state === "REJECTED" ? "risk" : agentCase.state === "HIGH_CONVICTION" ? "good" : "warn"}>
                  {agentCase.state}
                </SignalPill>
                <SignalPill>{agentCase.sessionMode}</SignalPill>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{agentCase.reason}</p>
            </div>
          )}
          {timeline.length > 0 && (
            <div className="border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">State timeline</p>
              <div className="mt-2 grid gap-2">
                {timeline.slice(0, 6).map((event, index) => (
                  <div key={`${event.ticker}-${event.eventKey}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-300">{event.previousState ?? "START"} → {event.state}</span>
                    <span className="text-zinc-500">{event.confidence}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {item.type === "setup" && <SetupDetails setup={item.setup} />}
          {item.type === "decision" && <DecisionDetails decision={item.decision} />}
          {item.type === "discovery" && <DiscoveryDetails candidate={item.candidate} />}
          {item.type === "rejected" && <RejectedDetails rejected={item.rejected} />}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-200">{value ?? "-"}</p>
    </div>
  );
}

function SetupDetails({ setup }: { setup: TerminalSetup }) {
  const summary = buildCaseSummary(setup);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Row label="Score" value={setup.preOpenScore} />
        <Row label="Confidence" value={setup.confidence} />
        <Row label="False positive" value={`${setup.falsePositiveRisk}%`} />
        <Row label="Action" value={setup.openingAction} />
      </div>
      <Row label="Why now" value={setup.whyNow} />
      <Row label="Catalyst" value={setup.catalyst} />
      <div className="grid gap-2 md:grid-cols-2">
        <Row label="For" value={summary.pros.join(", ") || "-"} />
        <Row label="Emot" value={summary.cons.join(", ") || "-"} />
        <Row label="Trigger" value={summary.trigger} />
        <Row label="Invalidation" value={summary.invalidation} />
      </div>
      <Row label="Invalidation" value={setup.invalidation} />
      <Row label="Confirmation" value={setup.openingPlan?.confirms} />
      {setup.liveMarketReaction && <LiveRows reaction={setup.liveMarketReaction} />}
      <Row label="Outcome history" value={`Winrate ${setup.historicalSetupWinrate}% · continuation ${setup.avgContinuation} · fade ${setup.avgFadeRisk}%`} />
    </>
  );
}

function DecisionDetails({ decision }: { decision: DecisionItem }) {
  return (
    <>
      <div className="flex gap-2">
        <SignalPill tone={decision.bucket === "act" ? "good" : decision.bucket === "avoid" ? "risk" : "warn"}>{decision.humanAction}</SignalPill>
        <SignalPill>{decision.source}</SignalPill>
      </div>
      <Row label="Decision" value={decision.reason} />
      <Row label="Confirmation" value={decision.confirmation} />
      <Row label="Invalidation" value={decision.invalidation} />
      <Row label="Technical action" value={decision.technicalAction} />
    </>
  );
}

function DiscoveryDetails({ candidate }: { candidate: AutonomousDiscoveryCandidate }) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <SignalPill tone={candidate.bucket === "RISK" ? "risk" : candidate.bucket === "HOT" ? "good" : "warn"}>{candidate.bucket}</SignalPill>
        {candidate.sourceTags.map((tag) => <SignalPill key={`${candidate.ticker}-${tag}`}>{tag}</SignalPill>)}
      </div>
      <Row label="Discovery score" value={candidate.autonomousDiscoveryScore} />
      <Row label="Why discovered" value={candidate.whyDiscovered.join(" · ")} />
      <Row label="Suppression" value={candidate.suppressionReasons.join(", ") || "Ingen"} />
      <Row label="Why not higher" value={candidate.whyNotRankedHigher.join(", ") || "Rankad enligt signalstyrka"} />
      <LiveRows reaction={candidate.reaction} />
    </>
  );
}

function RejectedDetails({ rejected }: { rejected: TerminalRejectedCandidate }) {
  return (
    <>
      <SignalPill tone="risk">Rejected</SignalPill>
      <Row label="Rejected reasons" value={rejected.rejectedBecause.join(", ")} />
      <Row label="Ticker confidence" value={rejected.tickerValidation?.identity.sourceConfidence} />
      <Row label="Exchange" value={rejected.tickerValidation?.identity.exchange} />
    </>
  );
}

function LiveRows({ reaction }: { reaction: NonNullable<TerminalSetup["liveMarketReaction"]> }) {
  return (
    <>
      <Row label="Live market pressure" value={reaction.reason} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Row label="RVOL" value={reaction.relativeVolume} />
        <Row label="Momentum" value={`${reaction.intradayMomentum}%`} />
        <Row label="Continuation" value={`${reaction.continuationProbability}%`} />
        <Row label="Fade" value={`${reaction.fadeProbability}%`} />
      </div>
    </>
  );
}
