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
  summary?: string;
  ecologicalSignificance?: string;
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

export async function getUserMetrics(uid: string) {
  const snapshot = await getDocs(metricsCollection(uid));
  return snapshot.docs.map((metric) => metric.data());
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

export function userSubcollection<T extends DocumentData>(
  uid: string,
  name: string,
) {
  return userCollection<T>(uid, name);
}
