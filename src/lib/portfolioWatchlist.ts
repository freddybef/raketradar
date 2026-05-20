import { supabase } from "./supabase";
import type { Tables } from "./database.types";

export type ManualWatchlistItem = Tables<"watchlist_items">;

export async function getOrCreateDefaultWatchlist(userId: string) {
  const existing = await supabase
    .from("watchlists")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing.error) return existing;
  if (existing.data) return existing;

  return supabase
    .from("watchlists")
    .insert({
      user_id: userId,
      name: "Terminal Watchlist",
      description: "Manuell bevakning for RaketRadar Terminal",
      is_default: true,
    })
    .select()
    .single();
}

export async function getManualWatchlistItems(userId: string) {
  return supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: true })
    .order("ticker", { ascending: true });
}

export async function upsertManualWatchlistItem(input: {
  userId: string;
  ticker: string;
  companyName?: string | null;
  market?: string | null;
  notes?: string | null;
}) {
  const watchlist = await getOrCreateDefaultWatchlist(input.userId);
  if (watchlist.error || !watchlist.data) return { data: null, error: watchlist.error };

  return supabase
    .from("watchlist_items")
    .upsert(
      {
        watchlist_id: watchlist.data.id,
        user_id: input.userId,
        ticker: input.ticker.toUpperCase().trim(),
        company_name: input.companyName?.trim() || input.ticker.toUpperCase().trim(),
        market: input.market?.trim() || "Sweden",
        notes: input.notes?.trim() || null,
        priority: 3,
      },
      { onConflict: "watchlist_id,ticker" }
    )
    .select()
    .single();
}

export async function deleteManualWatchlistItem(id: string) {
  return supabase.from("watchlist_items").delete().eq("id", id);
}
