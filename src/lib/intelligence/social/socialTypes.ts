export type SocialMentionSource =
  | "x"
  | "reddit"
  | "discord"
  | "placera"
  | "flashback";

export interface SocialMention {
  ticker: string;
  source: SocialMentionSource;
  mentions: number;
  sentiment?: number;
  velocity?: number;
  timestamp: string;
}

export interface SocialSnapshot {
  ticker: string;
  score: number;
  velocityScore: number;
  sentimentScore: number;
  unusualActivity: boolean;
  narrativeShift: boolean;
  sources: string[];
}

export type SocialBaseline = {
  ticker: string;
  averageMentions: number;
  averageVelocity: number;
};
