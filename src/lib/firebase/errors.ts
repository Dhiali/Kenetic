import { FirebaseError } from "firebase/app";

export function isOfflineError(error: unknown) {
  return (
    error instanceof FirebaseError &&
    ["unavailable", "network-request-failed", "deadline-exceeded"].includes(
      error.code,
    )
  );
}

export function isPermissionError(error: unknown) {
  return error instanceof FirebaseError && error.code === "permission-denied";
}

export function firebaseErrorMessage(error: unknown) {
  if (isOfflineError(error))
    return "You appear to be offline. Try again when connected.";
  if (isPermissionError(error))
    return "Firestore permission denied. Deploy the current Firestore rules, then try again.";
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
