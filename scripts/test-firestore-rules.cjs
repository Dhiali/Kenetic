const assert = require("node:assert/strict");
const { test } = require("node:test");
const { initializeApp, deleteApp } = require("firebase/app");
const {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
} = require("firebase/firestore");

const projectId = "demo-kenetic-rules";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("Run this test through the Firestore emulator; never against a live project.");
const separator = host.lastIndexOf(":");
if (separator < 0) throw new Error("Invalid FIRESTORE_EMULATOR_HOST.");
const hostname = host.slice(0, separator);
const port = Number(host.slice(separator + 1));
if (!["localhost", "127.0.0.1", "::1"].includes(hostname) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("The Firestore rules test requires a local emulator.");
}

function client(name, uid) {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, name);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, hostname, port, uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  return { app, db };
}

test("Firestore rules enforce account ownership and app record validation", async () => {
  const id = `rules-${Date.now()}`;
  const alice = client(`${id}-alice`, `${id}-alice`);
  const bob = client(`${id}-bob`, `${id}-bob`);
  const guest = client(`${id}-guest`);
  const uid = `${id}-alice`;
  const profile = doc(alice.db, "users", uid);
  const otherProfile = doc(bob.db, "users", uid);
  const guestProfile = doc(guest.db, "users", uid);
  const denied = async (promise) => assert.rejects(promise, (error) => error.code === "permission-denied");
  try {
    await setDoc(profile, {
      onboardingCompleted: false,
      authProvider: "anonymous",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await denied(getDoc(otherProfile));
    await denied(getDoc(guestProfile));
    await denied(updateDoc(otherProfile, { onboardingCompleted: true, updatedAt: serverTimestamp() }));
    await updateDoc(profile, { onboardingCompleted: true, updatedAt: serverTimestamp() });
    await updateDoc(profile, { termsAccepted: true, termsAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await denied(updateDoc(profile, { termsAccepted: false, updatedAt: serverTimestamp() }));
    await denied(updateDoc(profile, { termsAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await updateDoc(profile, { aiConsentVersion: "v1", updatedAt: serverTimestamp() });
    assert.equal((await getDoc(profile)).data().aiConsentVersion, "v1");
    await denied(updateDoc(otherProfile, { aiConsentVersion: "withdrawn", updatedAt: serverTimestamp() }));
    await denied(updateDoc(profile, { aiConsentVersion: "invalid", updatedAt: serverTimestamp() }));
    await updateDoc(profile, { aiConsentVersion: "withdrawn", updatedAt: serverTimestamp() });
    assert.equal((await getDoc(profile)).data().aiConsentVersion, "withdrawn");
    await updateDoc(profile, { aiConsentVersion: "v1", updatedAt: serverTimestamp() });

    const session = doc(alice.db, "users", uid, "sessions", "session");
    await setDoc(session, { type: "breathe", status: "started", startedAt: serverTimestamp() });
    await updateDoc(session, { status: "completed", completedAt: serverTimestamp(), durationSeconds: 180 });
    await updateDoc(session, { status: "completed", completedAt: serverTimestamp(), durationSeconds: 180 });
    assert.equal((await getDoc(session)).data().status, "completed");
    await denied(updateDoc(session, { durationSeconds: -1 }));

    const scan = doc(alice.db, "users", uid, "scanHistory", "scan");
    await setDoc(scan, { source: "camera", title: "Discovery", capturedAt: serverTimestamp(), mode: "visual", engine: "gemini-v1" });
    await denied(setDoc(doc(bob.db, "users", uid, "scanHistory", "other"), { source: "camera", title: "Other", capturedAt: serverTimestamp() }));
    await denied(setDoc(doc(alice.db, "users", uid, "scanHistory", "invalid"), { source: "camera", title: "Invalid", capturedAt: serverTimestamp(), engine: "invalid" }));
    await denied(setDoc(doc(alice.db, "users", uid, "metrics", "metric"), { type: "focus", value: 1 }));

    const quiz = doc(alice.db, "users", uid, "quizHistory", "quiz");
    await setDoc(quiz, {
      questionId: "scan-general-2026-11-09-pollination",
      prompt: "What can pollinators help flowering plants do?",
      source: "curiosity-quizzes",
      correct: true,
      answeredAt: serverTimestamp(),
    });
    assert.equal((await getDoc(quiz)).data().correct, true);
    await denied(updateDoc(quiz, { correct: false }));
    await denied(getDoc(doc(bob.db, "users", uid, "quizHistory", "quiz")));
    await deleteDoc(quiz);
    await deleteDoc(scan);
    await deleteDoc(session);
    await deleteDoc(profile);
  } finally {
    await Promise.all([alice, bob, guest].map(async ({ app, db }) => {
      await terminate(db);
      await deleteApp(app);
    }));
  }
});
