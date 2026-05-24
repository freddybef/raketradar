import { NextResponse, type NextRequest } from "next/server";
import { getMorningWarRoomInput } from "@/lib/db/intelligenceRepository";
import { buildMorningWarRoom } from "@/lib/intelligence/morningWarRoom";

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = await getMorningWarRoomInput();
  if (!input) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      mode: "missing_input",
      topPreOpenSetups: [],
      rejectedCandidates: [],
      acceptedCount: 0,
      rejectedCount: 0,
      verdict: {
        warRoomWorking: false,
        blocker: "missing_morning_war_room_input",
      },
    });
  }

  const warRoom = buildMorningWarRoom(input);
  return NextResponse.json({
    ...warRoom,
    calibration: {
      casesWithHistoricalSamples: warRoom.topPreOpenSetups.filter((item) => item.similarPastSetups.some((text) => /historiska matchningar/.test(text))).length,
      casesWithPositiveAdaptiveDelta: warRoom.topPreOpenSetups.filter((item) => item.adaptiveConfidenceDelta > 0).length,
      casesWithNegativeAdaptiveDelta: warRoom.topPreOpenSetups.filter((item) => item.adaptiveConfidenceDelta < 0).length,
      setupGrades: warRoom.topPreOpenSetups.reduce<Record<string, number>>((acc, item) => {
        acc[item.triggerComboGrade] = (acc[item.triggerComboGrade] ?? 0) + 1;
        return acc;
      }, {}),
    },
    verdict: {
      warRoomWorking: true,
      blocker:
        warRoom.topPreOpenSetups.length === 0
          ? "no_accepted_war_room_setups"
          : warRoom.topPreOpenSetups.every((item) => item.triggerComboGrade === "N/A")
            ? "no_historical_calibration_visible"
            : "none_obvious_from_war_room_endpoint",
    },
  });
}
