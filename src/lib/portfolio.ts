import { supabase } from "./supabase";
import type { Inserts, Tables, Updates } from "./database.types";

export type PortfolioPosition = Tables<"portfolio_positions">;
export type PortfolioPositionInsert = Inserts<"portfolio_positions">;
export type PortfolioPositionUpdate = Updates<"portfolio_positions">;

export async function getPortfolioPositions(userId: string) {
  return supabase
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", userId)
    .order("ticker", { ascending: true });
}

export async function upsertPortfolioPosition(position: PortfolioPositionInsert) {
  return supabase
    .from("portfolio_positions")
    .upsert(position, { onConflict: "user_id,ticker" })
    .select()
    .single();
}

export async function updatePortfolioPosition(
  id: string,
  updates: PortfolioPositionUpdate
) {
  return supabase
    .from("portfolio_positions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
}

export async function deletePortfolioPosition(id: string) {
  return supabase.from("portfolio_positions").delete().eq("id", id);
}
