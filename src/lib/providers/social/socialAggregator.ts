import { buildSocialSnapshots } from "@/lib/intelligence/social/socialSignals";
import type { SocialBaseline, SocialMention } from "@/lib/intelligence/social/socialTypes";
import { calculateVelocityChange } from "./trendVelocity";

export function aggregateSocialIntelligence(input: {
  current: SocialMention[];
  previous: SocialMention[];
  baselines?: SocialBaseline[];
}) {
  const snapshots = buildSocialSnapshots(input.current, input.baselines ?? []);
  const velocityChanges = calculateVelocityChange(input.current, input.previous);

  return {
    snapshots,
    velocityChanges,
    peopleTalkingAgain: velocityChanges.filter(
      (item) => item.firstSpikeAfterSilence
    ),
    crossPlatformSpread: velocityChanges.filter(
      (item) => item.crossPlatformSpread
    ),
  };
}
