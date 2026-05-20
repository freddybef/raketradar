import { NextResponse } from "next/server";
import { calculateLiveMarketReactions } from "@/lib/intelligence/liveMarketReaction";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";

const DEFAULT_SWEDISH_LIVE_UNIVERSE = ["EPIS B", "HOIST", "BIOA", "TOBII", "SINCH", "YUBICO", "ASTOR", "SIVE", "ADVE", "AAC", "SHT"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const querySymbols = url.searchParams.get("symbols")?.split(",").map((symbol) => symbol.trim()).filter(Boolean) ?? [];
  const configured = (process.env.LIVE_MARKET_SYMBOLS ?? "").split(",").map((symbol) => symbol.trim()).filter(Boolean);
  const symbols = [...new Set([...querySymbols, ...configured, ...DEFAULT_SWEDISH_LIVE_UNIVERSE])].slice(0, 80);
  const reactions = await calculateLiveMarketReactions({ symbols, provider: yahooLiveMarketReactionProvider });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: yahooLiveMarketReactionProvider.name,
    symbolsChecked: symbols.length,
    reactions,
  });
}
