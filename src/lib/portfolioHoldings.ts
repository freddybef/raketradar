import { supabase } from "./supabase";
import type { Inserts, Tables, Updates } from "./database.types";

export type PortfolioHolding = Tables<"portfolio_holdings">;
export type PortfolioHoldingInsert = Inserts<"portfolio_holdings">;
export type PortfolioHoldingUpdate = Updates<"portfolio_holdings">;
export type HoldingNote = Tables<"holding_notes">;

export async function getPortfolioHoldings(userId: string) {
  return supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("user_id", userId)
    .order("ticker", { ascending: true });
}

export async function upsertPortfolioHolding(holding: PortfolioHoldingInsert) {
  const ticker = holding.ticker.toUpperCase().trim();
  return supabase
    .from("portfolio_holdings")
    .upsert(
      {
        ...holding,
        ticker,
        isin: holding.isin?.trim() || null,
      },
      { onConflict: "user_id,ticker" }
    )
    .select()
    .single();
}

export async function upsertPortfolioHoldingByTickerOrIsin(holding: PortfolioHoldingInsert) {
  const ticker = holding.ticker.toUpperCase().trim();
  const isin = holding.isin?.trim() || null;
  const base = {
    ...holding,
    ticker,
    isin,
  };

  if (isin) {
    const existingByIsin = await supabase
      .from("portfolio_holdings")
      .select("id")
      .eq("user_id", holding.user_id)
      .eq("isin", isin)
      .maybeSingle();

    if (existingByIsin.error) return existingByIsin;
    if (existingByIsin.data) {
      return supabase.from("portfolio_holdings").update(base).eq("id", existingByIsin.data.id).select().single();
    }
  }

  return upsertPortfolioHolding(base);
}

export async function savePortfolioHoldingByTickerOrIsin(holding: PortfolioHoldingInsert): Promise<{
  data: PortfolioHolding | null;
  error: { message: string } | null;
  action: "inserted" | "updated";
}> {
  const ticker = holding.ticker.toUpperCase().trim();
  const isin = holding.isin?.trim() || null;
  const base = {
    ...holding,
    ticker,
    isin,
  };

  if (isin) {
    const existingByIsin = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", holding.user_id)
      .eq("isin", isin)
      .maybeSingle();

    if (existingByIsin.error) return { data: null, error: { message: existingByIsin.error.message }, action: "updated" };
    if (existingByIsin.data) {
      const updated = await supabase.from("portfolio_holdings").update(base).eq("id", existingByIsin.data.id).select().single();
      return {
        data: updated.data,
        error: updated.error ? { message: updated.error.message } : null,
        action: "updated",
      };
    }
  }

  const existingByTicker = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("user_id", holding.user_id)
    .eq("ticker", ticker)
    .maybeSingle();

  if (existingByTicker.error) return { data: null, error: { message: existingByTicker.error.message }, action: "updated" };
  if (existingByTicker.data) {
    const updated = await supabase.from("portfolio_holdings").update(base).eq("id", existingByTicker.data.id).select().single();
    return {
      data: updated.data,
      error: updated.error ? { message: updated.error.message } : null,
      action: "updated",
    };
  }

  const inserted = await supabase.from("portfolio_holdings").insert(base).select().single();
  return {
    data: inserted.data,
    error: inserted.error ? { message: inserted.error.message } : null,
    action: "inserted",
  };
}

export async function updatePortfolioHolding(id: string, updates: PortfolioHoldingUpdate) {
  return supabase.from("portfolio_holdings").update(updates).eq("id", id).select().single();
}

export async function deletePortfolioHolding(id: string) {
  return supabase.from("portfolio_holdings").delete().eq("id", id);
}

export async function addHoldingNote(note: Inserts<"holding_notes">) {
  return supabase.from("holding_notes").insert(note).select().single();
}
