import type { SqueezeResult } from "@/lib/intelligence/squeeze/squeezeDetector";

export function SqueezeBadge({ squeeze }: { squeeze: SqueezeResult }) {
  const hot = squeeze.score >= 70;

  return (
    <div
      className={`border rounded-xl px-3 py-2 ${
        hot
          ? "border-orange-500/30 bg-orange-500/15 text-orange-200"
          : "border-zinc-800 bg-zinc-950 text-zinc-300"
      }`}
    >
      <p className="text-xs opacity-80">Squeeze</p>
      <p className="font-bold">{squeeze.score}/100</p>
    </div>
  );
}
