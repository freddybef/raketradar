export interface RecoveryResult<T> {
  data: T;
  degraded: boolean;
  reason: string;
}

export function recoverWithFallback<T>(input: {
  liveData: T | null;
  cachedData: T | null;
  fallbackData: T;
  providerFailed: boolean;
}): RecoveryResult<T> {
  if (input.liveData && !input.providerFailed) {
    return { data: input.liveData, degraded: false, reason: "Live data aktiv" };
  }

  if (input.cachedData) {
    return {
      data: input.cachedData,
      degraded: true,
      reason: "Provider failade, använder fallback cache",
    };
  }

  return {
    data: input.fallbackData,
    degraded: true,
    reason: "Partial intelligence bevarar endast verifierade signaler",
  };
}
