import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT ?? "kenetic-development";
const seedTarget = process.env.SEED_TARGET ?? "emulator";

if (seedTarget !== "emulator") {
  throw new Error(
    "Seed data is restricted to the Firebase emulator. Set SEED_TARGET=emulator.",
  );
}

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = projectId;

initializeApp({ projectId });

const auth = getAuth();
const db = getFirestore();
const sampleDate = Timestamp.fromDate(new Date("2026-08-24T12:00:00.000Z"));

const users = [
  {
    uid: "seed-user-focus",
    email: "focus@example.com",
    displayName: "Focus Tester",
    notificationPreference: "sure",
  },
  {
    uid: "seed-user-outdoors",
    email: "outdoors@example.com",
    displayName: "Outdoors Tester",
    notificationPreference: "later",
  },
] as const;

const challenges = [
  {
    id: "notice-pattern",
    title: "Notice a natural pattern",
    description: "Find a repeated shape or texture outside.",
    category: "outdoors",
    active: true,
  },
  {
    id: "three-textures",
    title: "Find three textures",
    description: "Locate three distinct bark, stone, or leaf textures.",
    category: "outdoors",
    active: true,
  },
];

const features = [
  {
    id: "focus",
    title: "focus state.",
    description: "Protect deep attention with sound tether and app lock.",
  },
  {
    id: "breathe",
    title: "breathe state.",
    description: "Use tactile breathing practices to restore calm.",
  },
  {
    id: "outdoors",
    title: "outdoors state.",
    description: "Reconnect with the living world through ecotherapy.",
  },
];

async function ensureAuthUser(user: (typeof users)[number]) {
  try {
    await auth.getUser(user.uid);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found")
      throw error;
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });
  }
}

async function seed() {
  await Promise.all(users.map(ensureAuthUser));
  const batch = db.batch();

  for (const user of users) {
    const userRef = db.doc(`users/${user.uid}`);
    batch.set(userRef, {
      displayName: user.displayName,
      email: user.email,
      authProvider: "password",
      onboardingCompleted: true,
      notificationPreference: user.notificationPreference,
      createdAt: sampleDate,
      updatedAt: sampleDate,
    });

    batch.set(db.doc(`users/${user.uid}/sessions/${user.uid}-focus-session`), {
      type: "focus",
      status: "completed",
      startedAt: sampleDate,
      completedAt: Timestamp.fromDate(new Date("2026-08-24T15:30:00.000Z")),
      durationSeconds: 12600,
      metadata: { source: "seed" },
    });

    batch.set(db.doc(`users/${user.uid}/scanHistory/${user.uid}-scan`), {
      source: "manual",
      title: "oak tree",
      summary: "A broadleaf tree observed during a walk.",
      ecologicalSignificance: "Provides habitat and food for local wildlife.",
      latitude: 51.5074,
      longitude: -0.1278,
      capturedAt: sampleDate,
    });

    batch.set(db.doc(`users/${user.uid}/savedPlaces/${user.uid}-park`), {
      placeId: `${user.uid}-park`,
      name: "Sample Nature Park",
      address: "Development test location",
      latitude: 51.5074,
      longitude: -0.1278,
      category: "park",
      savedAt: sampleDate,
    });
  }

  for (const challenge of challenges) {
    batch.set(db.doc(`challenges/${challenge.id}`), {
      ...challenge,
      createdAt: sampleDate,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const feature of features) {
    batch.set(db.doc(`features/${feature.id}`), {
      ...feature,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(
    `Seeded ${users.length} users, ${challenges.length} challenges, and ${features.length} features.`,
  );
}

void seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
