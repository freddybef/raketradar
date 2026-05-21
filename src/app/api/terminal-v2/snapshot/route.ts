import { NextResponse } from "next/server";
import { buildCanonicalTradingSnapshot } from "@/lib/terminalV2/canonicalTradingSnapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildCanonicalTradingSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[terminal-v2] snapshot failed", error);
    return NextResponse.json(
      {
        error: "Terminal v2 kunde inte bygga canonical snapshot.",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
