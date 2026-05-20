import { NextResponse } from "next/server";
import { getAutonomyStatus } from "@/lib/intelligence/autonomyRunner";

export async function GET() {
  return NextResponse.json(await getAutonomyStatus());
}
