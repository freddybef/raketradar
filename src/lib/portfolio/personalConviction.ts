import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export interface PersonalConvictionProfile {
  smallCapFocus: number;
  asymmetricUpside: number;
  stealthSetups: number;
  swedishRunners: number;
  earlyDiscovery: number;
}

export const defaultRaketRadarProfile: PersonalConvictionProfile = {
  smallCapFocus: 0.22,
  asymmetricUpside: 0.24,
  stealthSetups: 0.22,
  swedishRunners: 0.16,
  earlyDiscovery: 0.16,
};

export function personalizeConviction(
  stock: RankedStock,
  profile = defaultRaketRadarProfile
) {
  const smallCap = stock.tags.includes("småbolag") ? 100 : 35;
  const stealth = stock.tags.includes("insider accumulation") ? 85 : 42;
  const early = stock.tags.includes("social heat") ? 55 : 78;
  const asymmetry = stock.tags.includes("squeeze") ? 80 : 58;
  const swedishRunner = stock.tags.includes("biotech turnaround") || stock.tags.includes("AI") ? 72 : 60;

  return Math.round(
    smallCap * profile.smallCapFocus +
      asymmetry * profile.asymmetricUpside +
      stealth * profile.stealthSetups +
      swedishRunner * profile.swedishRunners +
      early * profile.earlyDiscovery
  );
}
