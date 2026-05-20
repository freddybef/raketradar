import { NextResponse } from "next/server";
import { getLatestRunChanges } from "@/lib/db/runnerRepository";

export async function GET() {
  const changes = await getLatestRunChanges();
  return NextResponse.json(changes);
}
