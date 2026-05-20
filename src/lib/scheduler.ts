export type MarketSessionPhase =
  | "pre_open"
  | "opening"
  | "intraday"
  | "after_close"
  | "closed";

export type MarketSessionStatus = {
  phase: MarketSessionPhase;
  label: string;
  isTradingDay: boolean;
  isOpen: boolean;
  stockholmTime: string;
};

function stockholmNow(now = new Date()) {
  return new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" })
  );
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function nextWeekdayAt(hour: number, minute: number, now = new Date()) {
  const next = stockholmNow(now);
  next.setHours(hour, minute, 0, 0);

  if (next.getTime() <= stockholmNow(now).getTime()) {
    next.setDate(next.getDate() + 1);
  }

  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function getMarketSessionStatus(now = new Date()): MarketSessionStatus {
  const stockholm = stockholmNow(now);
  const day = stockholm.getDay();
  const minute = minutesSinceMidnight(stockholm);
  const isTradingDay = day >= 1 && day <= 5;
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(now);

  if (!isTradingDay) {
    return {
      phase: "closed",
      label: "Helg/stängt",
      isTradingDay,
      isOpen: false,
      stockholmTime: formatted,
    };
  }

  if (minute < 9 * 60) {
    return {
      phase: "pre_open",
      label: "Före öppning",
      isTradingDay,
      isOpen: false,
      stockholmTime: formatted,
    };
  }

  if (minute < 9 * 60 + 30) {
    return {
      phase: "opening",
      label: "Öppning",
      isTradingDay,
      isOpen: true,
      stockholmTime: formatted,
    };
  }

  if (minute < 17 * 60 + 30) {
    return {
      phase: "intraday",
      label: "Intradag",
      isTradingDay,
      isOpen: true,
      stockholmTime: formatted,
    };
  }

  return {
    phase: "after_close",
    label: "Efter stängning",
    isTradingDay,
    isOpen: false,
    stockholmTime: formatted,
  };
}

export function shouldRunMorningScan(now = new Date()) {
  const status = getMarketSessionStatus(now);
  return status.phase === "pre_open";
}

export function shouldRunIntradayScan(now = new Date()) {
  const status = getMarketSessionStatus(now);
  return status.phase === "opening" || status.phase === "intraday";
}

export function shouldRunAfterCloseScan(now = new Date()) {
  const status = getMarketSessionStatus(now);
  return status.phase === "after_close";
}

export function nextSuggestedScan(now = new Date()) {
  const status = getMarketSessionStatus(now);

  if (status.phase === "pre_open") {
    return {
      label: "Morgonscan före öppning",
      runAt: nextWeekdayAt(8, 15, now).toISOString(),
      reason: "Förbered kandidater, risker och watchlist innan handeln öppnar.",
    };
  }

  if (status.phase === "opening" || status.phase === "intraday") {
    const next = stockholmNow(now);
    next.setMinutes(next.getMinutes() + 30, 0, 0);

    return {
      label: "Intradagsscan",
      runAt: next.toISOString(),
      reason: "Fånga volymavvikelser, nyheter och score-förändringar under handel.",
    };
  }

  if (status.phase === "after_close") {
    return {
      label: "Efter stängning",
      runAt: nextWeekdayAt(17, 45, now).toISOString(),
      reason: "Sammanfatta dagens edge, risk och åtgärder inför morgondagen.",
    };
  }

  return {
    label: "Nästa handelsdag",
    runAt: nextWeekdayAt(8, 15, now).toISOString(),
    reason: "Marknaden är stängd. Nästa scan föreslås inför kommande öppning.",
  };
}
