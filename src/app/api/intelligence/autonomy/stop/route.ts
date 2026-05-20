import { NextResponse, type NextRequest } from "next/server";
import { isAutonomyAuthorized } from "@/app/api/intelligence/autonomy/auth";
import { stopAutonomy } from "@/lib/intelligence/autonomyRunner";

export async function POST(request: NextRequest) {
  if (!isAutonomyAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await stopAutonomy());
}
