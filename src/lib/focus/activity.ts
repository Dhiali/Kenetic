type ActivitySession = {
  type: string;
  status: string;
  completedAt?: unknown;
  durationSeconds?: number;
};

export function recentFocusActivity(sessions: ActivitySession[], now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const activeDays = new Set<string>();
  let sessionsCompleted = 0;
  let seconds = 0;

  for (const session of sessions) {
    if (session.type !== "focus" || session.status !== "completed") continue;
    const timestamp = session.completedAt;
    if (!timestamp || typeof timestamp !== "object" || !("toMillis" in timestamp) ||
        typeof timestamp.toMillis !== "function") continue;
    const millis: unknown = timestamp.toMillis();
    if (typeof millis !== "number" || !Number.isFinite(millis) ||
        millis < start.getTime() || millis > now.getTime()) continue;
    const date = new Date(millis);
    activeDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    sessionsCompleted += 1;
    if (typeof session.durationSeconds === "number" && Number.isFinite(session.durationSeconds) && session.durationSeconds > 0) {
      seconds += session.durationSeconds;
    }
  }
  return { sessionsCompleted, activeDays: activeDays.size, seconds };
}

export function formatFocusTime(seconds: number) {
  if (seconds <= 0) return "0m";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
