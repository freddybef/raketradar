import { NextResponse } from "next/server";
import { findSuspiciousUnknowns } from "@/lib/intelligence/discovery/suspiciousUnknowns";

export async function GET() {
  const result = await findSuspiciousUnknowns();
  return NextResponse.json(result);
}
