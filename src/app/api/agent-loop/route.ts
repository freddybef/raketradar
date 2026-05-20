import { NextResponse } from "next/server";
import { runAgentLoop } from "@/lib/agent/runAgentLoop";

export async function GET() {
  try {
    const result = await runAgentLoop();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[RaketRadar Agent Loop] failed", error);
    return NextResponse.json(
      {
        error: "Agent loop failed",
        details: error instanceof Error ? error.message : "Okant agent-loop fel",
      },
      { status: 500 }
    );
  }
}
