import {
    appleCredential,
    createEmailAccount,
    deleteCurrentUser,
    ensureAnonymousUser,
    getCurrentUser,
    googleCredential,
    signInWithEmailPassword,
    signInWithProviderCredential,
    signInWithProviderCredentialDirect,
    signOutCurrentUser,
    updateCurrentUserEmail,
    updateCurrentUserProfile,
} from "./auth";
import {
    abandonSession,
    completeSession,
    createBreatheExerciseLaunch,
    createDashboardSelection,
    createFocusFeatureLaunch,
    createOutdoorFeatureLaunch,
    createQuizHistory,
    createScanHistory,
    createUserProfile,
    deleteUserData,
    getBreatheDashboardMetrics,
    getFocusDashboardMetrics,
    getOutdoorDashboardMetrics,
    getQuizQueue,
    getUserProfile,
    markOnboardingComplete,
    saveChallengeProgress,
    saveInitialIntention,
    saveNotificationPreference,
    savePlace,
    saveRegisteredUserProfile,
    startSession,
    updateProfileDetails,
} from "./firestore";
import {
    registerForPushNotifications,
    subscribeToPushTokenRefresh,
} from "./notifications";
import { uploadProfilePhoto } from "./storage";

export async function bootstrapAnonymousUser() {
  const user = await ensureAnonymousUser();
  const profile = await getUserProfile(user.uid);

  if (!profile) {
    await createUserProfile(user.uid, {
      onboardingCompleted: false,
      email: user.email ?? undefined,
      authProvider: "anonymous",
    });
  }

  return user;
}

export async function restoreSignedInAccount() {
  const user = await bootstrapAnonymousUser();
  return user.isAnonymous ? null : user;
}

export async function persistOnboardingCompletion() {
  const user = await ensureAnonymousUser();
  await markOnboardingComplete(user.uid);
}

export async function persistInitialIntention(value: string) {
  const user = await ensureAnonymousUser();
  const canonicalValue = {
    "Deep work": "deep work",
    Nature: "nature",
    Peace: "peace",
  }[value] as "deep work" | "nature" | "peace" | undefined;
  if (!canonicalValue) throw new Error("Invalid onboarding intention.");
  await saveInitialIntention(user.uid, canonicalValue);
}

export async function getNotificationPreference() {
  const user = await ensureAnonymousUser();
  const profile = await getUserProfile(user.uid);
  return profile?.notificationPreference;
}

export async function persistNotificationPreference(
  preference: "later" | "sure",
) {
  const user = await ensureAnonymousUser();
  await saveNotificationPreference(user.uid, preference);

  if (preference === "sure") {
    const registration = await registerForPushNotifications(user.uid).catch(
      () => null,
    );
    if (registration) {
      subscribeToPushTokenRefresh(user.uid, registration.deviceId);
    }
  }
}

export async function persistDashboardSelection(
  state: "focus" | "outdoors" | "breathe",
) {
  const user = await ensureAnonymousUser();
  await createDashboardSelection(user.uid, state);
}

export async function syncNotificationDevice() {
  const user = await ensureAnonymousUser();
  const profile = await getUserProfile(user.uid);
  if (profile?.notificationPreference !== "sure") return;

  const registration = await registerForPushNotifications(user.uid).catch(
    () => null,
  );
  if (registration) {
    subscribeToPushTokenRefresh(user.uid, registration.deviceId);
  }
}

export async function loadCurrentProfile() {
  const user = await ensureAnonymousUser();
  return getUserProfile(user.uid);
}

export async function persistProfileName(displayName: string) {
  const user = await ensureAnonymousUser();
  const normalizedName = displayName.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 2) {
    throw new Error("Please enter a valid name.");
  }
  await updateCurrentUserProfile(normalizedName);
  await updateProfileDetails(user.uid, { displayName: normalizedName });
}

export async function persistProfileEmail(
  email: string,
  currentPassword: string,
) {
  const user = await ensureAnonymousUser();
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!currentPassword) {
    throw new Error("Enter your current password to change your email.");
  }
  await updateCurrentUserEmail(normalizedEmail, currentPassword);
  await updateProfileDetails(user.uid, { email: normalizedEmail });
}

export async function persistProfilePhoto(uri: string) {
  const user = await ensureAnonymousUser();
  const photoUrl = await uploadProfilePhoto(user.uid, uri);
  await updateProfileDetails(user.uid, { photoUrl });
  return photoUrl;
}

export async function persistProfilePhotoUrl(photoUrl: string) {
  const user = await ensureAnonymousUser();
  await updateProfileDetails(user.uid, { photoUrl });
}

export async function deleteCurrentAccount() {
  const user = getCurrentUser();
  if (!user) throw new Error("No signed-in account was found.");

  await deleteUserData(user.uid);
  await deleteCurrentUser();
}

export async function signOutCurrentAccount() {
  await signOutCurrentUser();
}

export async function registerUserAccount(values: {
  name: string;
  surname: string;
  email: string;
  password: string;
}) {
  const credential = await createEmailAccount(
    values.email.trim().toLowerCase(),
    values.password,
  );
  const displayName = `${values.name.trim()} ${values.surname.trim()}`;
  await updateCurrentUserProfile(displayName);
  await saveRegisteredUserProfile(credential.user.uid, {
    displayName,
    email: credential.user.email ?? values.email.trim().toLowerCase(),
    authProvider: "password",
    onboardingCompleted: false,
  });
  return credential.user;
}

export async function registerProviderAccount(
  provider: "google" | "apple",
  token: string,
  displayName?: string | null,
  email?: string | null,
  rawNonce?: string,
) {
  const credential = await signInWithProviderCredential(
    provider === "google"
      ? googleCredential(token)
      : appleCredential(token, rawNonce),
  );
  const resolvedName =
    displayName?.trim() || credential.user.displayName || "kenetic user";
  if (resolvedName) await updateCurrentUserProfile(resolvedName);
  await saveRegisteredUserProfile(credential.user.uid, {
    displayName: resolvedName,
    email: email || credential.user.email || undefined,
    authProvider: provider === "google" ? "google.com" : "apple.com",
    onboardingCompleted: false,
  });
  return credential.user;
}

export async function loginWithEmailAccount(email: string, password: string) {
  const credential = await signInWithEmailPassword(
    email.trim().toLowerCase(),
    password,
  );
  return credential.user;
}

export async function loginWithProviderAccount(
  provider: "google" | "apple",
  token: string,
  rawNonce?: string,
) {
  const credential = await signInWithProviderCredentialDirect(
    provider === "google"
      ? googleCredential(token)
      : appleCredential(token, rawNonce),
  );
  return credential.user;
}

export async function startFocusTether(
  platform: "spotify" | "apple-music",
  plannedMinutes: number,
) {
  const user = await ensureAnonymousUser();
  const session = await startSession(user.uid, "focus", {
    mode: "get-shit-done",
    platform,
    tetherSeconds: 120,
    plannedMinutes,
  });
  return session.id;
}

export async function finishFocusTether(
  sessionId: string,
  durationSeconds: number,
  completed: boolean,
) {
  const user = await ensureAnonymousUser();
  if (completed) {
    await completeSession(user.uid, sessionId, durationSeconds, {
      mode: "get-shit-done",
      handoffSeconds: 120,
      completionReason: "session-finished",
    });
  } else {
    await abandonSession(user.uid, sessionId, {
      mode: "get-shit-done",
      reason: "tether-expired",
    });
  }
}

export async function loadFocusDashboardMetrics() {
  const user = await ensureAnonymousUser();
  return getFocusDashboardMetrics(user.uid);
}

export async function loadBreatheDashboardMetrics() {
  const user = await ensureAnonymousUser();
  return getBreatheDashboardMetrics(user.uid);
}

export async function loadOutdoorDashboardMetrics() {
  const user = await ensureAnonymousUser();
  return getOutdoorDashboardMetrics(user.uid);
}

export async function loadOutdoorQuizQueue() {
  const user = await ensureAnonymousUser();
  return getQuizQueue(user.uid);
}

export async function persistBreatheExerciseLaunch(
  exercise: "calm-down" | "recenter" | "clear-mind" | "deep-relax",
) {
  const user = await ensureAnonymousUser();
  await createBreatheExerciseLaunch(user.uid, exercise);
}

export async function persistOutdoorScan(scan: {
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
}) {
  const user = await ensureAnonymousUser();
  await createScanHistory(user.uid, scan);
}

export async function persistOutdoorFeatureLaunch(
  feature: "bio-radar" | "quizzes" | "spot-finder" | "daily-challenges",
) {
  const user = await ensureAnonymousUser();
  await createOutdoorFeatureLaunch(user.uid, feature);
}

export async function startBioRadarSession(mode: "visual" | "acoustic") {
  const user = await ensureAnonymousUser();
  const session = await startSession(user.uid, "outdoors", {
    mode: "bio-radar",
    scanMode: mode,
  });
  return session.id;
}

export async function finishBioRadarSession(
  sessionId: string,
  durationSeconds: number,
  completed: boolean,
  metadata?: Record<string, unknown>,
) {
  const user = await ensureAnonymousUser();
  if (completed) {
    await completeSession(user.uid, sessionId, durationSeconds, {
      mode: "bio-radar",
      ...(metadata ?? {}),
    });
  } else {
    await abandonSession(user.uid, sessionId, {
      mode: "bio-radar",
      ...(metadata ?? {}),
    });
  }
}

export async function persistOutdoorQuizResult(result: {
  questionId: string;
  prompt: string;
  correct: boolean;
}) {
  const user = await ensureAnonymousUser();
  await createQuizHistory(user.uid, result);
}

export async function persistOutdoorChallenge(
  challengeId: string,
  status: "available" | "started" | "completed",
  metadata?: Record<string, unknown>,
) {
  const user = await ensureAnonymousUser();
  await saveChallengeProgress(user.uid, challengeId, {
    status,
    metadata,
    ...(status === "started" ? { startedAt: new Date() } : {}),
    ...(status === "completed" ? { completedAt: new Date() } : {}),
  });
}

export async function persistOutdoorPlace(place: {
  placeId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
}) {
  const user = await ensureAnonymousUser();
  await savePlace(user.uid, place.placeId, place);
}

export async function persistFocusFeatureLaunch(
  feature: "get-shit-done" | "alien-mode",
) {
  const user = await ensureAnonymousUser();
  await createFocusFeatureLaunch(user.uid, feature);
}

export async function startAlienModeSession(
  overwhelmingTask: string,
  microAction: string,
  prompt: string,
) {
  const user = await ensureAnonymousUser();
  const session = await startSession(user.uid, "focus", {
    mode: "alien-mode",
    overwhelmingTask,
    microAction,
    prompt,
  });
  return session.id;
}

export async function finishAlienModeSession(
  sessionId: string,
  durationSeconds: number,
  completed: boolean,
) {
  const user = await ensureAnonymousUser();
  if (completed) {
    await completeSession(user.uid, sessionId, durationSeconds, {
      mode: "alien-mode",
      completionReason: "session-finished",
    });
  } else {
    await abandonSession(user.uid, sessionId, {
      mode: "alien-mode",
      reason: "user-left-session",
    });
  }
}

export async function startBreatheSession(
  exercise: "calm-down" | "recenter" | "clear-mind" | "deep-relax",
  durationSeconds: number,
) {
  const user = await ensureAnonymousUser();
  const session = await startSession(user.uid, "breathe", {
    mode: "guided-breathe",
    exercise,
    plannedDurationSeconds: durationSeconds,
  });
  return session.id;
}

export async function finishBreatheSession(
  sessionId: string,
  durationSeconds: number,
  completed: boolean,
  exercise: string,
  interruptionCount = 0,
) {
  const user = await ensureAnonymousUser();
  if (completed) {
    await completeSession(user.uid, sessionId, durationSeconds, {
      mode: "guided-breathe",
      exercise,
      completionReason: "exercise-finished",
      interruptionCount,
    });
  } else {
    await abandonSession(user.uid, sessionId, {
      mode: "guided-breathe",
      exercise,
      reason: "user-left-exercise",
      interruptionCount,
    });
  }
}
