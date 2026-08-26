import {
    addDoc,
    collection,
    CollectionReference,
    deleteDoc,
    doc,
    DocumentData,
    DocumentReference,
    Firestore,
    getDoc,
    getDocs,
    getFirestore,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { firebaseApp } from "./app";

export const firestore: Firestore = getFirestore(firebaseApp);

export type UserProfile = {
  displayName?: string;
  email?: string;
  photoUrl?: string;
  authProvider?: "anonymous" | "google.com" | "apple.com" | string;
  onboardingCompleted: boolean;
  notificationPreference?: "later" | "sure";
  termsAccepted?: boolean;
  termsAcceptedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SessionRecord = {
  type: "focus" | "breathe" | "outdoors";
  startedAt: unknown;
  completedAt?: unknown;
  durationSeconds?: number;
  status: "started" | "completed" | "abandoned";
  metadata?: Record<string, unknown>;
};

export type MetricRecord = {
  type: "focus" | "breathe" | "outdoors";
  key: string;
  value: number;
  recordedAt: unknown;
};

export type NotificationEvent = {
  type:
    | "permission-requested"
    | "permission-granted"
    | "permission-denied"
    | "token-updated";
  platform?: "ios" | "android" | "web";
  createdAt: unknown;
  metadata?: Record<string, unknown>;
};

export type DeviceRecord = {
  token: string;
  platform: "ios" | "android" | "web";
  enabled: boolean;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ScanHistoryRecord = {
  source: "camera" | "microphone" | "manual";
  title: string;
  scientificName?: string;
  summary?: string;
  ecologicalSignificance?: string;
  somaticPrompt?: string;
  includeInDailyQuizzes?: boolean;
  mode?: "visual" | "acoustic";
  engine?: "deterministic-v1";
  scanSessionId?: string;
  matchScore?: number;
  capturedAssetUri?: string;
  latitude?: number;
  longitude?: number;
  capturedAt: unknown;
};

export type ChallengeProgressRecord = {
  challengeId: string;
  status: "available" | "started" | "completed";
  startedAt?: unknown;
  completedAt?: unknown;
  metadata?: Record<string, unknown>;
};

export type SavedPlaceRecord = {
  placeId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  savedAt: unknown;
};

export type IntentionRecord = {
  value: "deep work" | "nature" | "peace";
  source: "onboarding";
  selectedAt: unknown;
  createdAt?: unknown;
  updatedAt: unknown;
};

export type DashboardSelectionRecord = {
  state: "focus" | "outdoors" | "breathe";
  source: "dashboard";
  selectedAt: unknown;
};

export type FocusFeatureLaunchRecord = {
  feature: "get-shit-done" | "alien-mode";
  source: "focus-dashboard";
  launchedAt: unknown;
};

export type BreatheExerciseLaunchRecord = {
  exercise: "calm-down" | "recenter" | "clear-mind" | "deep-relax";
  source: "breathe-dashboard";
  launchedAt: unknown;
};

export type OutdoorFeatureLaunchRecord = {
  feature: "bio-radar" | "quizzes" | "spot-finder" | "daily-challenges";
  source: "outdoors-dashboard";
  launchedAt: unknown;
};

export type QuizHistoryRecord = {
  questionId: string;
  prompt: string;
  source: "curiosity-quizzes";
  correct: boolean;
  answeredAt: unknown;
};

export function userReference(uid: string): DocumentReference<UserProfile> {
  return doc(firestore, "users", uid) as DocumentReference<UserProfile>;
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(userReference(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export function updateProfileDetails(
  uid: string,
  profile: { displayName?: string; photoUrl?: string },
) {
  return updateUserProfile(uid, profile);
}

export function saveUserProfile(
  uid: string,
  profile: Omit<UserProfile, "createdAt" | "updatedAt">,
) {
  return setDoc(
    userReference(uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function updateUserProfile(
  uid: string,
  profile: Partial<Omit<UserProfile, "createdAt" | "updatedAt">>,
) {
  return setDoc(
    userReference(uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function saveTermsConsent(uid: string) {
  return setDoc(
    userReference(uid),
    {
      termsAccepted: true,
      termsAcceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveRegisteredUserProfile(
  uid: string,
  profile: Omit<
    UserProfile,
    "createdAt" | "updatedAt" | "termsAccepted" | "termsAcceptedAt"
  >,
) {
  const existing = await getDoc(userReference(uid));
  const data = {
    ...profile,
    termsAccepted: true as const,
    termsAcceptedAt: existing.exists()
      ? (existing.data().termsAcceptedAt ?? serverTimestamp())
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    return setDoc(
      userReference(uid),
      { ...data, createdAt: serverTimestamp() },
      { merge: true },
    );
  }

  return setDoc(userReference(uid), data, { merge: true });
}

export function createUserProfile(
  uid: string,
  profile: Omit<UserProfile, "createdAt" | "updatedAt">,
) {
  return setDoc(
    userReference(uid),
    { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function markOnboardingComplete(uid: string) {
  return updateDoc(userReference(uid), {
    onboardingCompleted: true,
    updatedAt: serverTimestamp(),
  });
}

export function userCollection<T extends DocumentData>(
  uid: string,
  name: string,
) {
  return collection(firestore, "users", uid, name) as CollectionReference<T>;
}

export const sessionsCollection = (uid: string) =>
  userCollection<SessionRecord>(uid, "sessions");
export const metricsCollection = (uid: string) =>
  userCollection<MetricRecord>(uid, "metrics");
export const notificationEventsCollection = (uid: string) =>
  userCollection<NotificationEvent>(uid, "notificationEvents");
export const devicesCollection = (uid: string) =>
  userCollection<DeviceRecord>(uid, "devices");
export const scanHistoryCollection = (uid: string) =>
  userCollection<ScanHistoryRecord>(uid, "scanHistory");
export const challengeProgressCollection = (uid: string) =>
  userCollection<ChallengeProgressRecord>(uid, "challengeProgress");
export const savedPlacesCollection = (uid: string) =>
  userCollection<SavedPlaceRecord>(uid, "savedPlaces");
export const intentionsCollection = (uid: string) =>
  userCollection<IntentionRecord>(uid, "intentions");
export const dashboardSelectionsCollection = (uid: string) =>
  userCollection<DashboardSelectionRecord>(uid, "dashboardSelections");
export const focusFeatureLaunchesCollection = (uid: string) =>
  userCollection<FocusFeatureLaunchRecord>(uid, "focusFeatureLaunches");
export const breatheExerciseLaunchesCollection = (uid: string) =>
  userCollection<BreatheExerciseLaunchRecord>(uid, "breatheExerciseLaunches");
export const outdoorFeatureLaunchesCollection = (uid: string) =>
  userCollection<OutdoorFeatureLaunchRecord>(uid, "outdoorFeatureLaunches");
export const quizHistoryCollection = (uid: string) =>
  userCollection<QuizHistoryRecord>(uid, "quizHistory");

export function createOutdoorFeatureLaunch(
  uid: string,
  feature: OutdoorFeatureLaunchRecord["feature"],
) {
  return addDoc(outdoorFeatureLaunchesCollection(uid), {
    feature,
    source: "outdoors-dashboard",
    launchedAt: serverTimestamp(),
  });
}

export function createQuizHistory(
  uid: string,
  entry: Omit<QuizHistoryRecord, "source" | "answeredAt">,
) {
  return addDoc(quizHistoryCollection(uid), {
    ...entry,
    source: "curiosity-quizzes",
    answeredAt: serverTimestamp(),
  });
}

export function createBreatheExerciseLaunch(
  uid: string,
  exercise: BreatheExerciseLaunchRecord["exercise"],
) {
  return addDoc(breatheExerciseLaunchesCollection(uid), {
    exercise,
    source: "breathe-dashboard",
    launchedAt: serverTimestamp(),
  });
}

export function createFocusFeatureLaunch(
  uid: string,
  feature: FocusFeatureLaunchRecord["feature"],
) {
  return addDoc(focusFeatureLaunchesCollection(uid), {
    feature,
    source: "focus-dashboard",
    launchedAt: serverTimestamp(),
  });
}

export function createDashboardSelection(
  uid: string,
  state: DashboardSelectionRecord["state"],
) {
  return addDoc(dashboardSelectionsCollection(uid), {
    state,
    source: "dashboard",
    selectedAt: serverTimestamp(),
  });
}

export async function saveInitialIntention(
  uid: string,
  value: IntentionRecord["value"],
): Promise<boolean> {
  const intentionReference = doc(intentionsCollection(uid), "current");
  return runTransaction(firestore, async (transaction) => {
    const existing = await transaction.get(intentionReference);
    if (existing.exists()) return false;

    const data: IntentionRecord = {
      value,
      source: "onboarding",
      selectedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    transaction.set(intentionReference, data);
    return true;
  });
}

export function createSession(uid: string, session: SessionRecord) {
  return addDoc(sessionsCollection(uid), session);
}

export function startSession(
  uid: string,
  type: SessionRecord["type"],
  metadata?: Record<string, unknown>,
) {
  return addDoc(sessionsCollection(uid), {
    type,
    status: "started",
    startedAt: serverTimestamp(),
    ...(metadata ? { metadata } : {}),
  });
}

export function completeSession(
  uid: string,
  sessionId: string,
  durationSeconds: number,
  metadata?: Record<string, unknown>,
) {
  return updateDoc(doc(sessionsCollection(uid), sessionId), {
    status: "completed",
    completedAt: serverTimestamp(),
    durationSeconds,
    ...(metadata ? { metadata } : {}),
  });
}

export function abandonSession(
  uid: string,
  sessionId: string,
  metadata?: Record<string, unknown>,
) {
  return updateDoc(doc(sessionsCollection(uid), sessionId), {
    status: "abandoned",
    completedAt: serverTimestamp(),
    ...(metadata ? { metadata } : {}),
  });
}

export async function getUserMetrics(uid: string) {
  const snapshot = await getDocs(metricsCollection(uid));
  return snapshot.docs.map((metric) => metric.data());
}

export async function getFocusDashboardMetrics(uid: string) {
  const snapshot = await getDocs(sessionsCollection(uid));
  const sessions = snapshot.docs.map((session) => session.data());
  const completedFocusSessions = sessions.filter(
    (session) => session.type === "focus" && session.status === "completed",
  );
  const getShitDoneSessions = completedFocusSessions.filter(
    (session) => session.metadata?.mode === "get-shit-done",
  );
  const alienModeSessions = completedFocusSessions.filter(
    (session) => session.metadata?.mode === "alien-mode",
  );
  const handoffCompletedSessions = getShitDoneSessions.filter(
    (session) => session.metadata?.handoffSeconds === 120,
  );
  const minutesFor = (records: typeof completedFocusSessions) =>
    records.reduce(
      (total, session) => total + (session.durationSeconds ?? 0) / 60,
      0,
    );

  return {
    completedSessions: completedFocusSessions.length,
    getShitDoneSessions: getShitDoneSessions.length,
    alienModeSessions: alienModeSessions.length,
    handoffCompletedSessions: handoffCompletedSessions.length,
    getShitDoneMinutes: Math.round(minutesFor(getShitDoneSessions)),
    alienModeMinutes: Math.round(minutesFor(alienModeSessions)),
    totalFocusMinutes: Math.round(minutesFor(completedFocusSessions)),
  };
}

export async function getBreatheDashboardMetrics(uid: string) {
  const snapshot = await getDocs(sessionsCollection(uid));
  const sessions = snapshot.docs
    .map((session) => session.data())
    .filter(
      (session) =>
        session.type === "breathe" &&
        session.metadata?.mode === "guided-breathe",
    );
  const now = new Date();
  const weekStart = new Date(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);
  const startedThisWeek = sessions.filter((session) => {
    const timestamp = session.startedAt as { toMillis?: () => number };
    return typeof timestamp?.toMillis === "function"
      ? timestamp.toMillis() >= weekStart.getTime()
      : true;
  });
  const completed = startedThisWeek.filter(
    (session) => session.status === "completed",
  );
  const totalSeconds = completed.reduce(
    (total, session) => total + (session.durationSeconds ?? 0),
    0,
  );
  return {
    completedSessions: completed.length,
    restorationMinutes: Math.round(totalSeconds / 60),
    recoveryIndex: startedThisWeek.length
      ? Math.round((completed.length / startedThisWeek.length) * 100)
      : 0,
  };
}

export function createNotificationEvent(
  uid: string,
  event: Omit<NotificationEvent, "createdAt">,
) {
  return addDoc(notificationEventsCollection(uid), {
    ...event,
    createdAt: serverTimestamp(),
  });
}

export function saveNotificationPreference(
  uid: string,
  preference: "later" | "sure",
) {
  return updateDoc(userReference(uid), {
    notificationPreference: preference,
    updatedAt: serverTimestamp(),
  });
}

export function saveDevice(
  uid: string,
  deviceId: string,
  device: Omit<DeviceRecord, "createdAt" | "updatedAt">,
) {
  return setDoc(
    doc(devicesCollection(uid), deviceId),
    { ...device, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
}

export function removeDevice(uid: string, deviceId: string) {
  return deleteDoc(doc(devicesCollection(uid), deviceId));
}

export async function deleteUserData(uid: string) {
  const subcollections = [
    "sessions",
    "metrics",
    "notificationEvents",
    "devices",
    "scanHistory",
    "challengeProgress",
    "savedPlaces",
    "intentions",
    "dashboardSelections",
    "outdoorFeatureLaunches",
    "quizHistory",
  ];

  for (const name of subcollections) {
    const snapshot = await getDocs(userCollection(uid, name));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  }

  await deleteDoc(userReference(uid));
}

export function createScanHistory(
  uid: string,
  scan: Omit<ScanHistoryRecord, "capturedAt">,
) {
  return addDoc(scanHistoryCollection(uid), {
    ...scan,
    capturedAt: serverTimestamp(),
  });
}

export function saveChallengeProgress(
  uid: string,
  challengeId: string,
  progress: Omit<ChallengeProgressRecord, "challengeId">,
) {
  return setDoc(
    doc(challengeProgressCollection(uid), challengeId),
    { ...progress, challengeId },
    { merge: true },
  );
}

export function savePlace(
  uid: string,
  placeId: string,
  place: Omit<SavedPlaceRecord, "placeId" | "savedAt">,
) {
  return setDoc(
    doc(savedPlacesCollection(uid), placeId),
    { ...place, placeId, savedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getOutdoorDashboardMetrics(uid: string) {
  const [scans, quizzes, sessionsSnapshot] = await Promise.all([
    getDocs(scanHistoryCollection(uid)),
    getDocs(quizHistoryCollection(uid)),
    getDocs(sessionsCollection(uid)),
  ]);
  const quizEntries = quizzes.docs.map((item) => item.data());
  const quizAttempts = quizEntries.length;
  const quizCorrect = quizEntries.filter((entry) => entry.correct).length;
  const masteryIndex = quizAttempts
    ? Math.round((quizCorrect / quizAttempts) * 100)
    : 0;

  const now = new Date();
  const weekStart = new Date(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = quizEntries.filter((entry) => {
    const timestamp = entry.answeredAt as { toMillis?: () => number };
    return typeof timestamp?.toMillis === "function"
      ? timestamp.toMillis() >= weekStart.getTime()
      : false;
  });
  const activeLearningDays = new Set(
    thisWeek.map((entry) => {
      const timestamp = entry.answeredAt as { toMillis?: () => number };
      const millis = timestamp.toMillis?.() ?? 0;
      const date = new Date(millis);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }),
  ).size;

  const bioRadarSessions = sessionsSnapshot.docs
    .map((item) => item.data())
    .filter(
      (session) =>
        session.type === "outdoors" && session.metadata?.mode === "bio-radar",
    );
  const bioRadarThisWeek = bioRadarSessions.filter((session) => {
    const timestamp = session.startedAt as { toMillis?: () => number };
    return typeof timestamp?.toMillis === "function"
      ? timestamp.toMillis() >= weekStart.getTime()
      : false;
  });
  const finalizedBioRadarSessions = bioRadarThisWeek.filter(
    (session) =>
      session.status === "completed" || session.status === "abandoned",
  ).length;
  const orphanedBioRadarSessions = bioRadarThisWeek.filter(
    (session) => session.status === "started",
  ).length;
  const recoveryIndex = bioRadarThisWeek.length
    ? Math.round((finalizedBioRadarSessions / bioRadarThisWeek.length) * 100)
    : 100;

  return {
    speciesScanned: scans.size,
    quizAttempts,
    masteryIndex,
    activeLearningDays,
    orphanedBioRadarSessions,
    recoveryIndex,
  };
}

export type QuizQueueItem = {
  scanId: string;
  title: string;
  scientificName?: string;
  capturedAssetUri?: string;
};

export async function getQuizQueue(
  uid: string,
  maxItems = 5,
): Promise<QuizQueueItem[]> {
  const [scansSnapshot, quizzesSnapshot] = await Promise.all([
    getDocs(scanHistoryCollection(uid)),
    getDocs(quizHistoryCollection(uid)),
  ]);

  const answeredQuestionIds = new Set(
    quizzesSnapshot.docs.map((entry) => entry.data().questionId),
  );

  // Freshly-written scans carry an unresolved serverTimestamp (null) until
  // the server acks it, so they must sort first to appear in the queue instantly.
  const millisOf = (data: ScanHistoryRecord) => {
    const timestamp = data.capturedAt as { toMillis?: () => number };
    return typeof timestamp?.toMillis === "function"
      ? timestamp.toMillis()
      : Number.POSITIVE_INFINITY;
  };
  const scans = scansSnapshot.docs
    .map((scan) => ({ id: scan.id, data: scan.data() }))
    .sort((a, b) => millisOf(b.data) - millisOf(a.data));

  const seenTitles = new Set<string>();
  const queue: QuizQueueItem[] = [];
  for (const scan of scans) {
    const data = scan.data;
    if (!data.includeInDailyQuizzes) continue;
    if (seenTitles.has(data.title)) continue;
    if (answeredQuestionIds.has(`scan-${scan.id}`)) continue;
    seenTitles.add(data.title);
    queue.push({
      scanId: scan.id,
      title: data.title,
      scientificName: data.scientificName,
      capturedAssetUri: data.capturedAssetUri,
    });
    if (queue.length >= maxItems) break;
  }
  return queue;
}

export function userSubcollection<T extends DocumentData>(
  uid: string,
  name: string,
) {
  return userCollection<T>(uid, name);
}
