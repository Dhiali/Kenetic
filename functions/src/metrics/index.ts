import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = getFirestore();

export const aggregateUserMetrics = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before aggregating metrics.",
    );
  }

  const uid = request.auth.uid;
  const sessions = await db.collection(`users/${uid}/sessions`).get();
  const totals = { focus: 0, breathe: 0, outdoors: 0 };

  sessions.forEach((session) => {
    const data = session.data();
    if (data.type in totals && typeof data.durationSeconds === "number") {
      totals[data.type as keyof typeof totals] += Math.max(
        0,
        data.durationSeconds,
      );
    }
  });

  const writes = Object.entries(totals).map(([type, durationSeconds]) =>
    db
      .doc(`users/${uid}/metrics/${type}_duration`)
      .set(
        {
          type,
          key: "durationSeconds",
          value: durationSeconds,
          recordedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
  );
  await Promise.all(writes);
  return totals;
});
