export const CHALLENGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CHALLENGES = [
  "Notice three different natural textures around you.",
  "Listen quietly for three sounds for one minute.",
  "Take a slow walk and notice five colours around you.",
  "Find a comfortable outdoor spot and take five slow breaths.",
  "Look for a repeating pattern in nature.",
  "Notice the movement of leaves, clouds, or water for a minute.",
  "Spend a minute observing light and shadow outside.",
] as const;

export function challengeWindow(anchor: number, now: number) {
  if (!Number.isSafeInteger(anchor) || anchor < 0 || anchor > 8640000000000000 || !Number.isSafeInteger(now) || now < anchor || now > 8640000000000000) {
    throw new Error("The challenge clock is invalid. Check your device's date and time.");
  }
  const index = Math.floor((now - anchor) / CHALLENGE_WINDOW_MS);
  const initialDay = new Date(anchor).getUTCDay();
  return {
    id: `daily-window-${anchor}-${index}`,
    challenge: CHALLENGES[(initialDay + index) % CHALLENGES.length],
    endsAt: anchor + (index + 1) * CHALLENGE_WINDOW_MS,
  };
}

export function challengeFromId(id: string): string | null {
  const rolling = /^daily-window-(\d+)-(\d+)$/.exec(id);
  if (rolling) {
    const anchor = Number(rolling[1]);
    const index = Number(rolling[2]);
    const start = anchor + index * CHALLENGE_WINDOW_MS;
    if (!Number.isSafeInteger(index) || !Number.isSafeInteger(start) || start > 8640000000000000) return null;
    return challengeWindow(anchor, start).challenge;
  }
  const legacy = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (legacy) {
    const date = new Date(`${legacy[1]}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== legacy[1]) return null;
    return CHALLENGES[date.getUTCDay()];
  }
  return null;
}

export function formatChallengeCountdown(endsAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

export type CompletedChallenge = { id: string; challenge: string; completedAt: number | null };

export function completedChallengeHistory(records: { challengeId: string; completedAt?: unknown; metadata?: Record<string, unknown> }[]): CompletedChallenge[] {
  return records.flatMap((record) => {
    const knownChallenge = challengeFromId(record.challengeId);
    if (!knownChallenge) return [];
    const savedChallenge = record.metadata?.challenge;
    const timestamp = record.completedAt;
    let completedAt: unknown = timestamp instanceof Date ? timestamp.getTime() : null;
    if (timestamp && typeof timestamp === "object" && "toMillis" in timestamp && typeof timestamp.toMillis === "function") {
      completedAt = timestamp.toMillis();
    }
    return [{
      id: record.challengeId,
      challenge: typeof savedChallenge === "string" && savedChallenge.trim() ? savedChallenge : knownChallenge,
      completedAt: typeof completedAt === "number" && Number.isFinite(completedAt) ? completedAt : null,
    }];
  }).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}
