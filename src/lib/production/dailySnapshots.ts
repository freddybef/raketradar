export type DailySnapshotType = "morning" | "midday" | "close";

export interface DailySnapshot<TPayload> {
  type: DailySnapshotType;
  capturedAt: string;
  payload: TPayload;
}

export function getSnapshotType(now = new Date()): DailySnapshotType {
  const hour = Number(
    new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Stockholm",
    }).format(now)
  );

  if (hour < 11) return "morning";
  if (hour < 16) return "midday";
  return "close";
}

export function createDailySnapshot<TPayload>(
  payload: TPayload,
  now = new Date()
): DailySnapshot<TPayload> {
  return {
    type: getSnapshotType(now),
    capturedAt: now.toISOString(),
    payload,
  };
}
