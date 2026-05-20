import { NextResponse, type NextRequest } from "next/server";
import { collectPendingOutcomes } from "@/lib/intelligence/outcomeCollector";

function isAuthorized(request: NextRequest) {
  const secrets = [process.env.INTELLIGENCE_RUN_SECRET, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-raketradar-secret");

  return secrets.some((secret) => headerSecret === secret || bearer === `Bearer ${secret}`);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized outcome collector run" }, { status: 401 });
  }

  const summary = await collectPendingOutcomes();
  return NextResponse.json(summary);
}
