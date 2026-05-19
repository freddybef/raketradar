import { NextResponse } from "next/server";
import { generateAndPersistOvernightSummary } from "@/lib/intelligence/autonomyRunner";

export async function GET() {
  const summary = await generateAndPersistOvernightSummary();
  return NextResponse.json(summary);
}
