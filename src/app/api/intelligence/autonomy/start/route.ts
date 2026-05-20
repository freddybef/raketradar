import { NextResponse, type NextRequest } from "next/server";
import { isAutonomyAuthorized } from "@/app/api/intelligence/autonomy/auth";
import { startAutonomy, type AutonomyMode } from "@/lib/intelligence/autonomyRunner";

export async function POST(request: NextRequest) {
  if (!isAutonomyAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    mode?: AutonomyMode;
    intervalMs?: number;
    runImmediately?: boolean;
  };
  const status = await startAutonomy({
    mode: body.mode,
    intervalMs: body.intervalMs,
    runImmediately: body.runImmediately,
  });
  return NextResponse.json(status);
}
