import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = getFirestore();
const placesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");

export const searchNearbyPlaces = onCall(
  { secrets: [placesApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in before searching places.",
      );
    }

    const {
      latitude,
      longitude,
      radius = 5000,
    } = request.data as Record<string, unknown>;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new HttpsError(
        "invalid-argument",
        "Valid latitude and longitude are required.",
      );
    }

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": placesApiKey.value(),
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.types",
        },
        body: JSON.stringify({
          includedTypes: ["park", "hiking_area"],
          maxResultCount: 20,
          locationRestriction: {
            circle: { center: { latitude, longitude }, radius },
          },
        }),
      },
    );

    if (!response.ok)
      throw new HttpsError(
        "internal",
        `Places request failed (${response.status}).`,
      );
    return response.json();
  },
);

export const processOutdoorScan = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError(
      "unauthenticated",
      "Sign in before processing a scan.",
    );
  const data = request.data as Record<string, unknown>;
  if (typeof data.title !== "string" || typeof data.source !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "A scan title and source are required.",
    );
  }

  const scan = {
    source: data.source,
    title: data.title,
    summary: typeof data.summary === "string" ? data.summary : undefined,
    ecologicalSignificance:
      typeof data.ecologicalSignificance === "string"
        ? data.ecologicalSignificance
        : undefined,
    latitude: typeof data.latitude === "number" ? data.latitude : undefined,
    longitude: typeof data.longitude === "number" ? data.longitude : undefined,
    capturedAt: FieldValue.serverTimestamp(),
  };
  const reference = await db
    .collection(`users/${request.auth.uid}/scanHistory`)
    .add(scan);
  return { scanId: reference.id, ...scan };
});
