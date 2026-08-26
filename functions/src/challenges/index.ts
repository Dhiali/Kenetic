import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();

// Challenge generation is intentionally deterministic until a paid AI provider is selected.
export const generateDailyChallenges = onSchedule(
  "every day 00:00",
  async () => {
    const challenges = [
      {
        id: "notice-pattern",
        title: "Notice a natural pattern",
        description: "Find a repeated shape or texture outside.",
      },
      {
        id: "three-textures",
        title: "Find three textures",
        description: "Locate three distinct bark, stone, or leaf textures.",
      },
    ];

    await Promise.all(
      challenges.map((challenge) =>
        db
          .doc(`challenges/${challenge.id}`)
          .set(
            {
              ...challenge,
              active: true,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
      ),
    );
  },
);
