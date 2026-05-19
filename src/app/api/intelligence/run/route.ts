import { NextResponse, type NextRequest } from "next/server";
import { runIntelligenceJobs, type IntelligenceJob, type IntelligenceRunReason } from "@/lib/intelligence/runner/runIntelligenceJobs";

function isAuthorized(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;

  const secrets = [
    process.env.INTELLIGENCE_RUN_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-raketradar-secret");

  return secrets.some(
    (secret) => headerSecret === secret || bearer === `Bearer ${secret}`
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    jobs?: IntelligenceJob[];
    reason?: IntelligenceRunReason;
  };
  const summary = await runIntelligenceJobs({
    jobs: body.jobs,
    reason: body.reason ?? "manual",
  });
  console.info("RaketRadar intelligence runner", summary);

  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
