import { File } from "expo-file-system";
import { ensureAnonymousUser } from "../firebase/auth";
import { hasAiConsent } from "./consent";

type TaskResult = { steps: string[] };
export type NatureResult = { name: string; scientificName: string; summary: string; uncertainty: string };
type AiRequest = { kind: "task"; task: string } | { kind: "photo"; mimeType: "image/jpeg"; data: string };

function endpoint() {
  const value = process.env.EXPO_PUBLIC_AI_SERVICE_URL?.trim();
  if (!value) throw new Error("AI is not configured yet. Ask the app owner to set up the AI service.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The AI service must use a secure HTTPS address.");
  return `${url.origin}/v1/analyze`;
}

async function requestAi(input: AiRequest): Promise<unknown> {
  const url = endpoint();
  const user = await ensureAnonymousUser();
  if (!(await hasAiConsent(user.uid))) {
    throw new Error("AI agreement is required. Review it in your profile before continuing.");
  }
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...input, consent: true, adult: true }),
      signal: controller.signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "AI service unavailable. Please try again.";
      throw new Error(message);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function makeTaskSteps(task: string): Promise<TaskResult> {
  const result = await requestAi({ kind: "task", task });
  if (!result || typeof result !== "object" || !("steps" in result) || !Array.isArray(result.steps) ||
      result.steps.length < 2 || result.steps.length > 6 ||
      result.steps.some((step: unknown) => typeof step !== "string" || !step.trim())) {
    throw new Error("The AI returned an incomplete task plan. Please try again.");
  }
  return { steps: result.steps };
}

export async function analyzeNature(uri: string): Promise<NatureResult> {
  const file = new File(uri);
  if (!file.exists || file.size > 2_000_000) throw new Error("The photo is missing or too large.");
  const data = await file.base64();
  const result = await requestAi({ kind: "photo", mimeType: "image/jpeg", data });
  if (!result || typeof result !== "object" ||
      !("name" in result) || typeof result.name !== "string" ||
      !("scientificName" in result) || typeof result.scientificName !== "string" ||
      !("summary" in result) || typeof result.summary !== "string" ||
      !("uncertainty" in result) || typeof result.uncertainty !== "string") {
    throw new Error("The AI returned an incomplete nature result. Please try again.");
  }
  return { name: result.name, scientificName: result.scientificName, summary: result.summary, uncertainty: result.uncertainty };
}
