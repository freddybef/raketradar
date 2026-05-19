import { NextResponse, type NextRequest } from "next/server";
import { isAutonomyAuthorized } from "@/app/api/intelligence/autonomy/auth";
import { getAutonomyStatus } from "@/lib/intelligence/autonomyRunner";
import { runLearningHarvest } from "@/lib/intelligence/learningHarvest";

export async function POST(request: NextRequest) {
  if (!isAutonomyAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getAutonomyStatus();
  const harvest = await runLearningHarvest({ sessionId: status.sessionId, reason: "manual-learning-harvest" });
  return NextResponse.json(harvest);
}
