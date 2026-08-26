import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    Auth,
    AuthCredential,
    EmailAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    User,
    UserCredential,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    getReactNativePersistence,
    initializeAuth,
    linkWithCredential,
    onAuthStateChanged,
    reauthenticateWithCredential,
    signInAnonymously,
    signInWithCredential,
    signOut,
    updateEmail,
    updateProfile,
} from "firebase/auth";
import { Platform } from "react-native";
import { firebaseApp } from "./app";

function createAuth(): Auth {
  if (Platform.OS === "web") {
    const auth = getAuth(firebaseApp);
    auth.setPersistence(browserLocalPersistence).catch(() => undefined);
    return auth;
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();

export function getCurrentUser() {
  return auth.currentUser;
}

export function deleteCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Cannot delete an account before signing in.");
  return deleteUser(user);
}

export async function ensureAnonymousUser(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function signInAsAnonymous(): Promise<UserCredential> {
  return signInAnonymously(auth);
}

export async function createEmailAccount(
  email: string,
  password: string,
): Promise<UserCredential> {
  const existingUser = auth.currentUser;
  const credential = EmailAuthProvider.credential(email, password);

  if (existingUser?.isAnonymous) {
    return linkWithCredential(existingUser, credential);
  }

  return createUserWithEmailAndPassword(auth, email, password);
}

export function updateCurrentUserProfile(displayName: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Cannot update a profile before signing in.");
  return updateProfile(user, { displayName });
}

export async function updateCurrentUserEmail(
  email: string,
  currentPassword: string,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Cannot update an email before signing in.");
  if (user.isAnonymous) {
    throw new Error("Create an account before changing your email.");
  }
  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, email);
}

export function observeAuthState(
  listener: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth, listener);
}

export function linkCurrentUser(
  credential: AuthCredential,
): Promise<UserCredential> {
  const user = auth.currentUser;
  if (!user) throw new Error("Cannot link an account before signing in.");
  return linkWithCredential(user, credential);
}

export function signInWithProviderCredential(
  credential: AuthCredential,
): Promise<UserCredential> {
  const existingUser = auth.currentUser;
  if (existingUser?.isAnonymous) {
    return linkWithCredential(existingUser, credential);
  }
  return signInWithCredential(auth, credential);
}

export function googleCredential(accessToken: string) {
  return GoogleAuthProvider.credential(null, accessToken);
}

export function appleCredential(idToken: string, rawNonce?: string) {
  return new OAuthProvider("apple.com").credential({ idToken, rawNonce });
}

export function signOutCurrentUser(): Promise<void> {
  return signOut(auth);
}
