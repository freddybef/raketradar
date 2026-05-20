import type { ReactNode } from "react";

export function TerminalPanel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-zinc-800 bg-zinc-950/95">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">{eyebrow}</p>}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyTerminalState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-zinc-800 bg-black/20 p-4">
      <p className="text-zinc-300 font-medium">{title}</p>
      <p className="text-sm text-zinc-500 mt-1">{body}</p>
    </div>
  );
}

export function SignalPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "risk" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
      : tone === "risk"
        ? "border-red-500/30 text-red-300 bg-red-500/10"
        : tone === "warn"
          ? "border-yellow-500/30 text-yellow-200 bg-yellow-500/10"
          : "border-zinc-700 text-zinc-300 bg-zinc-900";

  return <span className={`inline-flex items-center border px-2 py-1 text-[11px] ${toneClass}`}>{children}</span>;
}

