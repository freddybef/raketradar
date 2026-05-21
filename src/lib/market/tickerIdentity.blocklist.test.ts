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

export function verifyMedivirMenticeIdentitiesAreDistinct() {
  const medivirFromCurrentTicker = resolveTickerIdentity({
    ticker: "MVIR",
    companyName: "Medivir AB",
    source: "identity-regression-test",
    swedishFirstMode: true,
  });
  const medivirFromOldClassBTicker = resolveTickerIdentity({
    ticker: "MVIR B",
    companyName: "Medivir AB",
    source: "identity-regression-test",
    swedishFirstMode: true,
  });
  const mentice = resolveTickerIdentity({
    ticker: "MNTC",
    companyName: "Mentice AB",
    source: "identity-regression-test",
    swedishFirstMode: true,
  });

  return {
    pass:
      medivirFromCurrentTicker.identity.ticker === "MVIR" &&
      medivirFromCurrentTicker.identity.companyName === "Medivir AB" &&
      medivirFromOldClassBTicker.identity.ticker === "MVIR" &&
      medivirFromOldClassBTicker.identity.companyName === "Medivir AB" &&
      mentice.identity.ticker === "MNTC" &&
      mentice.identity.companyName === "Mentice AB",
    medivirFromCurrentTicker,
    medivirFromOldClassBTicker,
    mentice,
  };
}
