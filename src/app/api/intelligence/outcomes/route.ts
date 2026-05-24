import { NextResponse, type NextRequest } from "next/server";
import { collectPendingOutcomes } from "@/lib/intelligence/outcomeCollector";
import { getOutcomeLearningReport, getSignalOutcomeRows } from "@/lib/db/intelligenceRepository";

function isAuthorized(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;

  const secrets = [process.env.INTELLIGENCE_RUN_SECRET, process.env.CRON_SECRET]
    .filter((value): value is string => Boolean(value));

  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-raketradar-secret");
  return secrets.some((secret) => headerSecret === secret || bearer === `Bearer ${secret}`);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function firstItems<T>(value: T[] | null | undefined, count = 10) {
  return Array.isArray(value) ? value.slice(0, count) : [];
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 80);
  const runCollector = request.nextUrl.searchParams.get("run") !== "false";
  const beforeRows = await getSignalOutcomeRows(3000);
  const collector = runCollector ? await collectPendingOutcomes({ limit }) : null;
  const [afterRows, learningReport] = await Promise.all([
    getSignalOutcomeRows(3000),
    getOutcomeLearningReport(),
  ]);

  const evaluated = afterRows.filter((row) => row.observedPrice !== null || row.followThroughQuality !== null);
  const pending = afterRows.filter((row) => row.observedPrice === null && row.followThroughQuality === null);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    runCollector,
    before: {
      totalRows: beforeRows.length,
    },
    collector,
    after: {
      totalRows: afterRows.length,
      evaluated: evaluated.length,
      pending: pending.length,
      horizons: countBy(afterRows.map((row) => row.horizon)),
      evaluatedByHorizon: countBy(evaluated.map((row) => row.horizon)),
      pendingByHorizon: countBy(pending.map((row) => row.horizon)),
      topEvaluated: evaluated.slice(0, 25).map((row) => ({
        signalId: row.signalId,
        ticker: row.ticker,
        horizon: row.horizon,
        triggeredAt: row.triggeredAt,
        conviction: row.conviction,
        maxUpsidePercent: row.maxUpsidePercent,
        downsidePercent: row.downsidePercent,
        followThroughQuality: row.followThroughQuality,
        catalystMix: row.catalystMix,
      })),
    },
    learningReport: {
      evaluatedCount: learningReport.evaluatedCount ?? 0,
      pendingCount: learningReport.pendingCount ?? 0,
      topContinuationSetups: firstItems(learningReport.topContinuationSetups),
      topPerformingTriggerCombos: firstItems(learningReport.topPerformingTriggerCombos),
      worstTriggerCombos: firstItems(learningReport.worstTriggerCombos),
    },
    verdict: {
      outcomeLoopWorking: Boolean(collector && (collector.updated > 0 || evaluated.length > 0)),
      blocker:
        afterRows.length === 0
          ? "no_signal_outcome_rows"
          : collector && collector.processed === 0
            ? "no_pending_outcomes_to_process"
            : collector && collector.missingMarketData.length > collector.updated
              ? "market_data_missing_for_outcomes"
              : evaluated.length === 0
                ? "no_evaluated_outcomes_yet"
                : "none_obvious_from_outcomes_endpoint",
    },
  });
}
