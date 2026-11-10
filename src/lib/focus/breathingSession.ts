export type BreathingGuidance = "flexible" | "chest";

export function parseBreathingSession(values: (string | null)[], now: number) {
  const [sessionId, deadline, exercise, duration, guidance] = values;
  if ([sessionId, deadline, exercise, duration, guidance].every((value) => value === null)) return null;
  if (!sessionId || !deadline || !exercise || !duration) throw new Error("Saved breathing session is incomplete.");
  if (!Number.isFinite(Number(deadline)) || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
    throw new Error("Saved breathing timer is invalid.");
  }
  if (guidance !== null && guidance !== "chest" && guidance !== "flexible") {
    throw new Error("Saved breathing guidance is invalid.");
  }
  const savedGuidance: BreathingGuidance = guidance ?? "chest";
  return {
    sessionId,
    exercise,
    duration: Number(duration),
    guidance: savedGuidance,
    remaining: Math.max(0, Math.ceil((Number(deadline) - now) / 1000)),
  };
}
