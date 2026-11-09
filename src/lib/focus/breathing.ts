export type BreathingExercise = "calm-down" | "recenter" | "clear-mind" | "deep-relax";

type BreathPhase = {
  name: string;
  seconds: number;
  scale: number;
};

const patterns: Record<BreathingExercise, readonly BreathPhase[]> = {
  "calm-down": [
    { name: "inhale", seconds: 4, scale: 1.55 },
    { name: "second inhale", seconds: 1, scale: 2.05 },
    { name: "exhale", seconds: 6, scale: 0.28 },
    { name: "rest", seconds: 2, scale: 0.2 },
  ],
  recenter: [
    { name: "inhale", seconds: 4, scale: 1.55 },
    { name: "hold", seconds: 7, scale: 1.55 },
    { name: "exhale", seconds: 8, scale: 0.28 },
  ],
  "clear-mind": [
    { name: "inhale", seconds: 4, scale: 1.55 },
    { name: "hold after inhale", seconds: 4, scale: 1.55 },
    { name: "exhale", seconds: 4, scale: 0.28 },
    { name: "hold after exhale", seconds: 4, scale: 0.28 },
  ],
  "deep-relax": [
    { name: "inhale", seconds: 4, scale: 1.55 },
    { name: "exhale", seconds: 6, scale: 0.28 },
  ],
};

export function getBreathPhase(exercise: BreathingExercise, elapsed: number) {
  const pattern = patterns[exercise];
  const cycleDuration = pattern.reduce((total, phase) => total + phase.seconds, 0);
  const elapsedSeconds = Math.max(0, elapsed);
  const cycle = Math.floor(elapsedSeconds / cycleDuration);
  let position = elapsedSeconds % cycleDuration;
  for (const phase of pattern) {
    if (position < phase.seconds) {
      return {
        key: `${cycle}:${phase.name}`,
        name: phase.name,
        scale: phase.scale,
        remainingSeconds: phase.seconds - position,
      };
    }
    position -= phase.seconds;
  }
  throw new Error("Invalid breathing pattern.");
}
