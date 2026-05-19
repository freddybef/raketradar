import { NextResponse } from "next/server";
import { getLatestInsiderEvents } from "@/lib/db/intelligenceRepository";

export async function GET() {
  const events = await getLatestInsiderEvents(30);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: events.length > 0 ? "stored" : "empty",
    events,
  });
}
