import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = getFirestore();

export const syncUserProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before syncing a profile.",
    );
  }

  const uid = request.auth.uid;
  const data = request.data as Record<string, unknown>;
  const profile = {
    displayName:
      typeof data.displayName === "string" ? data.displayName : undefined,
    email: request.auth.token.email ?? undefined,
    authProvider: request.auth.token.firebase?.sign_in_provider ?? "anonymous",
    onboardingCompleted: data.onboardingCompleted === true,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.doc(`users/${uid}`).set(profile, { merge: true });
  return { uid };
});
