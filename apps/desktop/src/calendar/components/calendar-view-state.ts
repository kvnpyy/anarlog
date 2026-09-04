import type { SyncStatus } from "./context";

export function shouldShowCalendarFirstFill({
  enabledCalendarCount,
  eventCount,
  status,
}: {
  enabledCalendarCount: number;
  eventCount: number;
  status: SyncStatus;
}) {
  return enabledCalendarCount > 0 && eventCount === 0 && status !== "idle";
}
