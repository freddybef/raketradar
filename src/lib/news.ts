import { supabase } from "./supabase";
import type { Tables } from "./database.types";

export type NewsItem = Tables<"news_items">;

export async function getNewsItems(limit = 30) {
  return supabase
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
}

export async function getNewsForTicker(ticker: string, limit = 20) {
  return supabase
    .from("news_items")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .order("published_at", { ascending: false })
    .limit(limit);
}

export function getMockNewsFeed(): NewsItem[] {
  const now = new Date().toISOString();

  return [
    {
      id: "mock-news-ncc",
      ticker: "NCC",
      company_name: "NCC AB",
      headline: "NCC tecknar utvärderingsavtal med europeisk partner",
      summary: "Nyheten bedöms kunna korta vägen till kommersiell validering.",
      source: "Mock PM feed",
      url: null,
      sentiment: "positive",
      impact_score: 86,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-order",
      ticker: "NCC",
      company_name: "NCC AB",
      headline: "NCC får order värd 18 MSEK från tysk kund",
      summary: "Order-PM med tydligt ordervärde och leverans under kommande två kvartal.",
      source: "MFN Mock",
      url: null,
      sentiment: "positive",
      impact_score: 88,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-insider",
      ticker: "MEDI",
      company_name: "MediSignal AB",
      headline: "Ledande befattningshavare köper aktier i MediSignal",
      summary: "Insiderköp efter rapporten signalerar ökat förtroende från ledningen.",
      source: "Finwire Mock",
      url: null,
      sentiment: "positive",
      impact_score: 72,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-emission",
      ticker: "NANO",
      company_name: "NanoMaterials Sweden",
      headline: "NanoMaterials utvärderar finansiering och möjlig riktad emission",
      summary: "Emissionsrisk efter hög burn rate och behov av rörelsekapital.",
      source: "Cision Mock",
      url: null,
      sentiment: "negative",
      impact_score: 82,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-ceo",
      ticker: "MEDI",
      company_name: "MediSignal AB",
      headline: "MediSignal byter vd och inleder strategisk översyn",
      summary: "Vd-byte kombineras med strategisk översyn av produktportföljen.",
      source: "Placera Mock",
      url: null,
      sentiment: "neutral",
      impact_score: 61,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-report",
      ticker: "NCC",
      company_name: "NCC AB",
      headline: "NCC rapport överraskar med högre omsättning och positivt EBIT",
      summary: "Rapportöverraskning med förbättrad marginal och höjd helårsambition.",
      source: "Börskollen Mock",
      url: null,
      sentiment: "positive",
      impact_score: 80,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-biotech",
      ticker: "MEDI",
      company_name: "MediSignal AB",
      headline: "MediSignal presenterar positiva studieresultat i fas II",
      summary: "Biotech-resultat visar signifikant förbättring i primär endpoint.",
      source: "MFN Mock",
      url: null,
      sentiment: "positive",
      impact_score: 91,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-target",
      ticker: "NCC",
      company_name: "NCC AB",
      headline: "Analytiker höjer riktkurs för NCC efter partneravtal",
      summary: "Riktkurshöjning efter namngivet partneravtal och höjda estimat.",
      source: "Finwire Mock",
      url: null,
      sentiment: "positive",
      impact_score: 69,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-partner",
      ticker: "NANO",
      company_name: "NanoMaterials Sweden",
      headline: "NanoMaterials tecknar strategiskt partneravtal med nordisk industrigrupp",
      summary: "Partneravtal omfattar pilotproduktion och möjlig kommersiell utrullning.",
      source: "Cision Mock",
      url: null,
      sentiment: "positive",
      impact_score: 84,
      published_at: now,
      created_at: now,
    },
    {
      id: "mock-news-nano",
      ticker: "NANO",
      company_name: "NanoMaterials Sweden",
      headline: "Kundpilot driver ökat intresse i tunn microcap",
      summary: "Socialt buzz och förbättrad likviditet följer efter pilotbesked.",
      source: "Mock news feed",
      url: null,
      sentiment: "positive",
      impact_score: 74,
      published_at: now,
      created_at: now,
    },
  ];
}
