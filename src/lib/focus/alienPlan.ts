export type AlienPlan = {
  task: string;
  prompt: string;
  steps: string[];
  index: number;
  durationSeconds: number;
  status: "active" | "complete";
};

export function parseAlienPlan(value: string): AlienPlan {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Saved focus plan is invalid.");
  const plan = parsed as Record<string, unknown>;
  if (typeof plan.task !== "string" || !plan.task.trim() ||
      typeof plan.prompt !== "string" || !plan.prompt.trim() ||
      !Array.isArray(plan.steps) || plan.steps.length === 0 ||
      plan.steps.some((step: unknown) => typeof step !== "string" || !step.trim()) ||
      typeof plan.index !== "number" || !Number.isInteger(plan.index) ||
      plan.index < 0 || plan.index >= plan.steps.length ||
      typeof plan.durationSeconds !== "number" || !Number.isInteger(plan.durationSeconds) ||
      plan.durationSeconds < 60 || plan.durationSeconds > 600 || plan.durationSeconds % 60 !== 0 ||
      (plan.status !== "active" && plan.status !== "complete")) {
    throw new Error("Saved focus plan is invalid.");
  }
  return {
    task: plan.task,
    prompt: plan.prompt,
    steps: plan.steps,
    index: plan.index,
    durationSeconds: plan.durationSeconds,
    status: plan.status,
  };
}

export function alienElapsedSeconds(deadline: number, durationSeconds: number, now: number) {
  return Math.max(0, Math.min(durationSeconds, durationSeconds - Math.ceil((deadline - now) / 1000)));
}
