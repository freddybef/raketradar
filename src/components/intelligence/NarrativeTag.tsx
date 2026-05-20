import type { NarrativeResult } from "@/lib/intelligence/narrative/narrativeEngine";

export function NarrativeTag({ narrative }: { narrative: NarrativeResult }) {
  return (
    <span className="border border-cyan-500/25 bg-cyan-500/15 text-cyan-200 px-3 py-1 rounded-full text-xs font-semibold">
      {narrative.primaryNarrative} · {narrative.narrativeStrength}
    </span>
  );
}
