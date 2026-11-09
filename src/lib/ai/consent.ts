import { getDocFromServer, serverTimestamp, updateDoc } from "firebase/firestore";
import { ensureAnonymousUser } from "../firebase/auth";
import { userReference } from "../firebase/firestore";

export const AI_CONSENT_VERSION = "v1";

export async function hasAiConsent(uid: string): Promise<boolean> {
  const profile = await getDocFromServer(userReference(uid));
  if (!profile.exists()) throw new Error("Your account profile could not be loaded.");
  return profile.data().aiConsentVersion === AI_CONSENT_VERSION;
}

export async function loadAiConsent(): Promise<boolean> {
  const user = await ensureAnonymousUser();
  return hasAiConsent(user.uid);
}

export async function setAiConsent(agreed: boolean): Promise<void> {
  const user = await ensureAnonymousUser();
  await updateDoc(userReference(user.uid), {
    aiConsentVersion: agreed ? AI_CONSENT_VERSION : "withdrawn",
    updatedAt: serverTimestamp(),
  });
}
