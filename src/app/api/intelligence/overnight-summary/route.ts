import { NextResponse } from "next/server";
import { generateOvernightSummary } from "@/lib/intelligence/overnightSummary";

export async function GET() {
  const summary = await generateOvernightSummary();
  return NextResponse.json(summary);
}
