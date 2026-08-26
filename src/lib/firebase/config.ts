const requiredEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} as const;

function requireEnv(name: keyof typeof requiredEnv, value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing Firebase environment variable for ${name}.`);
  }
  return normalized;
}

export const firebaseConfig = {
  apiKey: requireEnv("apiKey", requiredEnv.apiKey),
  authDomain: requireEnv("authDomain", requiredEnv.authDomain),
  projectId: requireEnv("projectId", requiredEnv.projectId),
  storageBucket: requireEnv("storageBucket", requiredEnv.storageBucket),
  messagingSenderId: requireEnv(
    "messagingSenderId",
    requiredEnv.messagingSenderId,
  ),
  appId: requireEnv("appId", requiredEnv.appId),
};

export const googlePlacesApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || null;

export const cloudinaryCloudName =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || null;
export const cloudinaryUploadPreset =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || null;

export const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null;
export const googleAndroidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || null;
export const googleIosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null;

export const firebaseEnvironment =
  process.env.EXPO_PUBLIC_FIREBASE_ENV?.trim() || "development";

export const useFirebaseEmulators =
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true";
