export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      user_profile: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          base_currency: string;
          risk_profile: "conservative" | "balanced" | "aggressive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          base_currency?: string;
          risk_profile?: "conservative" | "balanced" | "aggressive";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          base_currency?: string;
          risk_profile?: "conservative" | "balanced" | "aggressive";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      portfolio_positions: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          company_name: string;
          market: string | null;
          shares: number;
          average_price: number;
          current_price: number;
          currency: string;
          thesis: string | null;
          risk_note: string | null;
          target_price: number | null;
          stop_loss: number | null;
          status: "active" | "watching" | "closed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          company_name: string;
          market?: string | null;
          shares?: number;
          average_price?: number;
          current_price?: number;
          currency?: string;
          thesis?: string | null;
          risk_note?: string | null;
          target_price?: number | null;
          stop_loss?: number | null;
          status?: "active" | "watching" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          company_name?: string;
          market?: string | null;
          shares?: number;
          average_price?: number;
          current_price?: number;
          currency?: string;
          thesis?: string | null;
          risk_note?: string | null;
          target_price?: number | null;
          stop_loss?: number | null;
          status?: "active" | "watching" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      portfolio_holdings: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          company_name: string | null;
          exchange: string | null;
          source_market: string | null;
          isin: string | null;
          currency: string;
          country: string | null;
          avg_entry: number;
          size: number;
          conviction: number;
          notes: string | null;
          strategy_bucket: "core" | "swing" | "speculative" | "event-driven";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          company_name?: string | null;
          exchange?: string | null;
          source_market?: string | null;
          isin?: string | null;
          currency?: string;
          country?: string | null;
          avg_entry?: number;
          size?: number;
          conviction?: number;
          notes?: string | null;
          strategy_bucket?: "core" | "swing" | "speculative" | "event-driven";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          company_name?: string | null;
          exchange?: string | null;
          source_market?: string | null;
          isin?: string | null;
          currency?: string;
          country?: string | null;
          avg_entry?: number;
          size?: number;
          conviction?: number;
          notes?: string | null;
          strategy_bucket?: "core" | "swing" | "speculative" | "event-driven";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      holding_notes: {
        Row: {
          id: string;
          user_id: string;
          holding_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          holding_id: string;
          note: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          holding_id?: string;
          note?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      watchlists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watchlist_items: {
        Row: {
          id: string;
          watchlist_id: string;
          user_id: string;
          ticker: string;
          company_name: string;
          market: string | null;
          target_entry: number | null;
          target_exit: number | null;
          notes: string | null;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          watchlist_id: string;
          user_id: string;
          ticker: string;
          company_name: string;
          market?: string | null;
          target_entry?: number | null;
          target_exit?: number | null;
          notes?: string | null;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          watchlist_id?: string;
          user_id?: string;
          ticker?: string;
          company_name?: string;
          market?: string | null;
          target_entry?: number | null;
          target_exit?: number | null;
          notes?: string | null;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_signals: {
        Row: {
          id: string;
          ticker: string;
          company_name: string;
          market: string | null;
          score: number;
          signal_type: string;
          action: string;
          confidence: number | null;
          time_horizon: string | null;
          trigger_source: string | null;
          risk_level: string | null;
          description: string;
          ai_reason: string | null;
          source_url: string | null;
          detected_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticker: string;
          company_name: string;
          market?: string | null;
          score: number;
          signal_type: string;
          action: string;
          confidence?: number | null;
          time_horizon?: string | null;
          trigger_source?: string | null;
          risk_level?: string | null;
          description: string;
          ai_reason?: string | null;
          source_url?: string | null;
          detected_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticker?: string;
          company_name?: string;
          market?: string | null;
          score?: number;
          signal_type?: string;
          action?: string;
          confidence?: number | null;
          time_horizon?: string | null;
          trigger_source?: string | null;
          risk_level?: string | null;
          description?: string;
          ai_reason?: string | null;
          source_url?: string | null;
          detected_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      news_items: {
        Row: {
          id: string;
          ticker: string | null;
          company_name: string | null;
          headline: string;
          summary: string | null;
          source: string | null;
          url: string | null;
          sentiment: "positive" | "neutral" | "negative" | null;
          impact_score: number | null;
          published_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticker?: string | null;
          company_name?: string | null;
          headline: string;
          summary?: string | null;
          source?: string | null;
          url?: string | null;
          sentiment?: "positive" | "neutral" | "negative" | null;
          impact_score?: number | null;
          published_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticker?: string | null;
          company_name?: string | null;
          headline?: string;
          summary?: string | null;
          source?: string | null;
          url?: string | null;
          sentiment?: "positive" | "neutral" | "negative" | null;
          impact_score?: number | null;
          published_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_analyses: {
        Row: {
          id: string;
          user_id: string | null;
          ticker: string;
          company_name: string | null;
          analysis_type: string;
          thesis: string;
          bull_case: string | null;
          bear_case: string | null;
          recommendation: string | null;
          confidence: number | null;
          model: string | null;
          inputs: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ticker: string;
          company_name?: string | null;
          analysis_type?: string;
          thesis: string;
          bull_case?: string | null;
          bear_case?: string | null;
          recommendation?: string | null;
          confidence?: number | null;
          model?: string | null;
          inputs?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          ticker?: string;
          company_name?: string | null;
          analysis_type?: string;
          thesis?: string;
          bull_case?: string | null;
          bear_case?: string | null;
          recommendation?: string | null;
          confidence?: number | null;
          model?: string | null;
          inputs?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          company_name: string | null;
          alert_type: "price_above" | "price_below" | "signal_score" | "news" | "volume" | "custom";
          threshold_value: number | null;
          message: string;
          is_active: boolean;
          triggered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          company_name?: string | null;
          alert_type: "price_above" | "price_below" | "signal_score" | "news" | "volume" | "custom";
          threshold_value?: number | null;
          message: string;
          is_active?: boolean;
          triggered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          company_name?: string | null;
          alert_type?: "price_above" | "price_below" | "signal_score" | "news" | "volume" | "custom";
          threshold_value?: number | null;
          message?: string;
          is_active?: boolean;
          triggered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
