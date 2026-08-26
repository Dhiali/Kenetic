import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { firebaseConfig } from "./config";

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
