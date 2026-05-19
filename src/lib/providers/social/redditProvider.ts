import type { SocialMention } from "@/lib/intelligence/social/socialTypes";

export interface RedditProviderOptions {
  subreddits?: string[];
  query?: string;
  limit?: number;
}

const DEFAULT_SUBREDDITS = ["Aktiemarknaden", "ISKbets", "stocks", "smallstreetbets"];

function scoreSentiment(text: string) {
  const positive = ["bull", "köp", "raket", "turnaround", "order", "partner"];
  const negative = ["emission", "scam", "varning", "sell", "konkurs"];
  const normalized = text.toLowerCase();
  const pos = positive.filter((word) => normalized.includes(word)).length;
  const neg = negative.filter((word) => normalized.includes(word)).length;
  return Math.max(-1, Math.min(1, (pos - neg) / 3));
}

function extractTicker(text: string, knownTickers: string[]) {
  const normalized = text.toUpperCase();
  return knownTickers.find((ticker) => normalized.includes(ticker.toUpperCase()));
}

export async function fetchRedditMentions(
  knownTickers: string[],
  options?: RedditProviderOptions
): Promise<SocialMention[]> {
  const subreddits = options?.subreddits ?? DEFAULT_SUBREDDITS;
  const query = encodeURIComponent(options?.query ?? knownTickers.join(" OR "));
  const limit = options?.limit ?? 25;
  const mentions: SocialMention[] = [];

  for (const subreddit of subreddits) {
    try {
      const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&restrict_sr=1&sort=new&limit=${limit}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );

      if (!response.ok) continue;

      const payload = (await response.json()) as {
        data?: { children?: Array<{ data?: { title?: string; selftext?: string; created_utc?: number } }> };
      };

      for (const child of payload.data?.children ?? []) {
        const text = `${child.data?.title ?? ""} ${child.data?.selftext ?? ""}`;
        const ticker = extractTicker(text, knownTickers);
        if (!ticker) continue;

        mentions.push({
          ticker,
          source: "reddit",
          mentions: 1,
          sentiment: scoreSentiment(text),
          velocity: 1,
          timestamp: child.data?.created_utc
            ? new Date(child.data.created_utc * 1000).toISOString()
            : new Date().toISOString(),
        });
      }
    } catch {
      continue;
    }
  }

  return mentions;
}
