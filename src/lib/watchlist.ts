import { supabase } from "./supabase";
import type { Inserts, Tables, Updates } from "./database.types";

export type Watchlist = Tables<"watchlists">;
export type WatchlistItem = Tables<"watchlist_items">;
export type WatchlistInsert = Inserts<"watchlists">;
export type WatchlistItemInsert = Inserts<"watchlist_items">;
export type WatchlistUpdate = Updates<"watchlists">;
export type WatchlistItemUpdate = Updates<"watchlist_items">;

export async function getWatchlists(userId: string) {
  return supabase
    .from("watchlists")
    .select("*, watchlist_items(*)")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
}

export async function createWatchlist(watchlist: WatchlistInsert) {
  return supabase.from("watchlists").insert(watchlist).select().single();
}

export async function updateWatchlist(id: string, updates: WatchlistUpdate) {
  return supabase.from("watchlists").update(updates).eq("id", id).select().single();
}

export async function addWatchlistItem(item: WatchlistItemInsert) {
  return supabase
    .from("watchlist_items")
    .upsert(item, { onConflict: "watchlist_id,ticker" })
    .select()
    .single();
}

export async function updateWatchlistItem(id: string, updates: WatchlistItemUpdate) {
  return supabase
    .from("watchlist_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteWatchlistItem(id: string) {
  return supabase.from("watchlist_items").delete().eq("id", id);
}
