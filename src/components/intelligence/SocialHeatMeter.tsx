import type { SocialSnapshot } from "@/lib/intelligence/social/socialTypes";

export function SocialHeatMeter({ social }: { social: SocialSnapshot }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-zinc-500 text-xs">Social heat</p>
        <p className="font-bold">{social.score}/100</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-green-400"
          style={{ width: `${social.score}%` }}
        />
      </div>
      <p className="text-zinc-500 text-xs mt-2">
        {social.sources.join(", ")} · velocity {social.velocityScore}
      </p>
    </div>
  );
}
