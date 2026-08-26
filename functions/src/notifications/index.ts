import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();

// Scheduled delivery is prepared for a paid Firebase plan. Sending remains outside the client.
export const sendScheduledNotifications = onSchedule(
  "every 24 hours",
  async () => {
    const users = await db
      .collection("users")
      .where("notificationPreference", "==", "sure")
      .get();
    console.log(`Notification job found ${users.size} opted-in users.`);
  },
);

export const cleanupStaleDeviceTokens = onSchedule(
  "every 24 hours",
  async () => {
    const users = await db.collection("users").get();
    console.log(`Token cleanup job inspected ${users.size} users.`);
  },
);
