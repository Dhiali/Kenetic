import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
    createNotificationEvent,
    DeviceRecord,
    removeDevice,
    saveDevice,
} from "./firestore";

const deviceIdKey = "@kenetic/notification-device-id";

type NotificationPlatform = DeviceRecord["platform"];

function currentPlatform(): NotificationPlatform {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  return "web";
}

async function getDeviceId() {
  const existingId = await AsyncStorage.getItem(deviceIdKey);
  if (existingId) return existingId;

  const newId = `${currentPlatform()}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  await AsyncStorage.setItem(deviceIdKey, newId);
  return newId;
}

async function recordPermissionEvent(
  uid: string,
  type: "permission-requested" | "permission-granted" | "permission-denied",
) {
  await createNotificationEvent(uid, {
    type,
    platform: currentPlatform(),
  }).catch(() => undefined);
}

export async function registerForPushNotifications(uid: string) {
  if (Platform.OS === "web") return null;

  const existing = await Notifications.getPermissionsAsync();
  let permission = existing.status;

  if (permission !== "granted") {
    await recordPermissionEvent(uid, "permission-requested");
    permission = (await Notifications.requestPermissionsAsync()).status;
  }

  if (permission !== "granted") {
    await recordPermissionEvent(uid, "permission-denied");
    return null;
  }

  await recordPermissionEvent(uid, "permission-granted");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#16a34a",
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const deviceId = await getDeviceId();

  await saveDevice(uid, deviceId, {
    token,
    platform: currentPlatform(),
    enabled: true,
  });
  await createNotificationEvent(uid, {
    type: "token-updated",
    platform: currentPlatform(),
    metadata: { deviceId },
  }).catch(() => undefined);

  return { deviceId, token };
}

export function subscribeToPushTokenRefresh(uid: string, deviceId: string) {
  return Notifications.addPushTokenListener((nextToken) => {
    void saveDevice(uid, deviceId, {
      token: nextToken.data,
      platform: currentPlatform(),
      enabled: true,
    });
    void createNotificationEvent(uid, {
      type: "token-updated",
      platform: currentPlatform(),
      metadata: { deviceId },
    });
  });
}

export function unregisterDevice(uid: string, deviceId: string) {
  return removeDevice(uid, deviceId);
}
