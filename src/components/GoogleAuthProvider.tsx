import * as Google from "expo-auth-session/providers/google";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import {
  googleAndroidClientId,
  googleIosClientId,
  googleWebClientId,
} from "../lib/firebase/config";

export type GoogleAuth = ReturnType<typeof Google.useAuthRequest> | null;

type Props = {
  children: (auth: GoogleAuth) => ReactNode;
};

function ConfiguredGoogleAuth({ children }: Props) {
  const auth = Google.useAuthRequest({
    clientId: googleWebClientId ?? undefined,
    androidClientId: googleAndroidClientId ?? undefined,
    iosClientId: googleIosClientId ?? undefined,
    webClientId: googleWebClientId ?? undefined,
    selectAccount: true,
  });
  return children(auth);
}

export default function GoogleAuthProvider({ children }: Props) {
  const platformClientId = Platform.select({
    ios: googleIosClientId,
    android: googleAndroidClientId,
    default: googleWebClientId,
  });

  if (!platformClientId && !googleWebClientId) {
    return children(null);
  }

  return <ConfiguredGoogleAuth>{children}</ConfiguredGoogleAuth>;
}
