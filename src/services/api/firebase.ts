// services/api/firebase.ts
// @ts-nocheck
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';

// Firebase configuration
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Google Auth Provider
export const googleAuthProvider = new GoogleAuthProvider();

// Authentication Methods
export const signInWithGoogle = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
};

export const signInAnonymouslyAsync = async () => {
  return signInAnonymously(auth);
};

export const signInWithApple = async (identityToken: string, nonce: string) => {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: identityToken,
    rawNonce: nonce,
  });
  return signInWithCredential(auth, credential);
};

// Firestore Collections
export const COLLECTIONS = {
  USERS: 'users',
  HABITS: 'habits',
  HABIT_COMPLETIONS: 'habit_completions',
  NATURE_SCANS: 'nature_scans',
  LOCATIONS: 'locations',
  USER_LOCATIONS: 'user_locations',
  POINTS: 'points',
};

// Helper to get current user ID
export const getCurrentUserId = () => {
  return auth.currentUser?.uid || null;
};

// app.json configuration for Firebase
/*
{
  "expo": {
    "extra": {
      "firebaseApiKey": "YOUR_API_KEY",
      "firebaseAuthDomain": "YOUR_AUTH_DOMAIN",
      "firebaseProjectId": "YOUR_PROJECT_ID",
      "firebaseStorageBucket": "YOUR_STORAGE_BUCKET",
      "firebaseMessagingSenderId": "YOUR_SENDER_ID",
      "firebaseAppId": "YOUR_APP_ID"
    }
  }
}
*/