import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

export async function getSession() {
  return supabase.auth.getSession();
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function ensureUserProfile(user: User) {
  return supabase.from("user_profile").upsert({
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata.name ?? null,
  });
}
