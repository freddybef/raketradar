import type { SocialBaseline, SocialMention, SocialSnapshot } from "./socialTypes";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateSocialScore(
  mentions: SocialMention[],
  baseline?: SocialBaseline
): SocialSnapshot {
  const ticker = mentions[0]?.ticker ?? baseline?.ticker ?? "UNKNOWN";
  const totalMentions = mentions.reduce((sum, mention) => sum + mention.mentions, 0);
  const totalVelocity = mentions.reduce(
    (sum, mention) => sum + (mention.velocity ?? mention.mentions),
    0
  );
  const sourceCount = new Set(mentions.map((mention) => mention.source)).size;
  const sentimentAverage = average(
    mentions
      .map((mention) => mention.sentiment)
      .filter((value): value is number => typeof value === "number")
  );
  const mentionBaseline = baseline?.averageMentions ?? Math.max(20, totalMentions / 2);
  const velocityBaseline = baseline?.averageVelocity ?? Math.max(8, totalVelocity / 2);
  const mentionSpike = mentionBaseline > 0 ? totalMentions / mentionBaseline : 1;
  const velocitySpike = velocityBaseline > 0 ? totalVelocity / velocityBaseline : 1;
  const acceleration = mentions.length >= 2 ? velocitySpike * 12 : 6;
  const spreadScore = clamp((sourceCount / 5) * 100);
  const velocityScore = clamp(velocitySpike * 28 + acceleration);
  const sentimentScore = clamp(50 + sentimentAverage * 50);
  const spikeScore = clamp(mentionSpike * 30);
  const score = clamp(
    velocityScore * 0.34 +
      spreadScore * 0.22 +
      sentimentScore * 0.22 +
      spikeScore * 0.22
  );

  return {
    ticker,
    score,
    velocityScore,
    sentimentScore,
    unusualActivity: mentionSpike >= 2.2 || velocitySpike >= 2.5,
    narrativeShift: sourceCount >= 3 && velocityScore >= 70,
    sources: Array.from(new Set(mentions.map((mention) => mention.source))),
  };
}
