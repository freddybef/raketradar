import { supabase } from "./supabase";
import type { Inserts, Tables, Updates } from "./database.types";

export type Alert = Tables<"alerts">;
export type AlertInsert = Inserts<"alerts">;
export type AlertUpdate = Updates<"alerts">;

export async function getAlerts(userId: string) {
  return supabase
    .from("alerts")
    .select("*")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function createAlert(alert: AlertInsert) {
  return supabase.from("alerts").insert(alert).select().single();
}

export async function updateAlert(id: string, updates: AlertUpdate) {
  return supabase.from("alerts").update(updates).eq("id", id).select().single();
}

export async function deleteAlert(id: string) {
  return supabase.from("alerts").delete().eq("id", id);
}
