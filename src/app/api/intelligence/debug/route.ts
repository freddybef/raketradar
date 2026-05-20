import { NextResponse } from "next/server";
import {
  getIntelligenceDebugSnapshot,
  getMorningWarRoomInput,
} from "@/lib/db/intelligenceRepository";
import { buildMorningWarRoom } from "@/lib/intelligence/morningWarRoom";

export async function GET() {
  const [debug, warRoomInput] = await Promise.all([
    getIntelligenceDebugSnapshot(),
    getMorningWarRoomInput(),
  ]);
  const latestWarRoom = warRoomInput ? buildMorningWarRoom(warRoomInput) : null;

  return NextResponse.json({
    ...debug,
    tickerIdentity: latestWarRoom?.tickerValidation ?? {
      tickerMismatches: [],
      exchangeConflicts: [],
      unresolvedSymbols: [],
      confidenceBreakdown: [],
    },
    rejected_signals: latestWarRoom?.rejectedCandidates ?? [],
    latestWarRoom,
  });
}
