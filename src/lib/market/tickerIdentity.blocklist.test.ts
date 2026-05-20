import { resolveTickerIdentity } from "@/lib/market/tickerIdentity";

export function verifyBioxIsBlockedFromSwedishWarRoom() {
  const result = resolveTickerIdentity({
    ticker: "BIOX",
    source: "mock-provider-test",
    swedishFirstMode: true,
  });

  return {
    pass:
      !result.isDisplayable &&
      result.identity.exchange === "Nasdaq US" &&
      result.rejectionReasons.includes("non_swedish_exchange"),
    result,
  };
}
