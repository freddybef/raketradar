import { supabase } from "./supabase";
import type { Inserts, Tables } from "./database.types";

export type AiAnalysis = Tables<"ai_analyses">;
export type AiAnalysisInsert = Inserts<"ai_analyses">;

export async function getAiAnalyses(userId: string, limit = 30) {
  return supabase
    .from("ai_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getAiAnalysesForTicker(
  userId: string,
  ticker: string,
  limit = 10
) {
  return supabase
    .from("ai_analyses")
    .select("*")
    .eq("user_id", userId)
    .eq("ticker", ticker.toUpperCase())
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function createAiAnalysis(analysis: AiAnalysisInsert) {
  return supabase.from("ai_analyses").insert(analysis).select().single();
}

export function getMockAiAnalysisFeed(userId: string): AiAnalysis[] {
  const now = new Date().toISOString();

  return [
    {
      id: "mock-ai-ncc",
      user_id: userId,
      ticker: "NCC",
      company_name: "NCC AB",
      analysis_type: "edge_summary",
      thesis:
        "NCC rankar högt eftersom nyhetsimpact och ovanlig volym förstärker varandra.",
      bull_case: "Order-PM, 4x+ volym och positivt momentum skapar kortsiktig edge.",
      bear_case: "Likviditet och snabb sentimentvändning är största svagheterna.",
      recommendation: "STARK BEVAKNING",
      confidence: 84,
      model: "mock-edge-engine-v1",
      inputs: { source: "mock_live_feed" },
      created_at: now,
    },
    {
      id: "mock-ai-nano",
      user_id: userId,
      ticker: "NANO",
      company_name: "NanoMaterials Sweden",
      analysis_type: "edge_summary",
      thesis:
        "NANO har ett starkt microcap-upplägg men behöver bekräftad volym för högre conviction.",
      bull_case: "Tunn float, socialt buzz och momentum kan ge snabb repricing.",
      bear_case: "Hög spread och begränsad historisk omsättning ökar risken.",
      recommendation: "BEVAKA",
      confidence: 76,
      model: "mock-edge-engine-v1",
      inputs: { source: "mock_live_feed" },
      created_at: now,
    },
  ];
}
