import { googlePlacesApiKey } from "../firebase/config";
import type { Coordinates } from "./location";

export type NearbyPlace = {
  placeId: string;
  name: string;
  address?: string;
  location?: Coordinates;
  types?: string[];
};

type PlacesResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: Coordinates;
    types?: string[];
  }>;
};

export async function searchNearbyPlaces(
  center: Coordinates,
  radius = 5000,
  includedTypes = ["park", "hiking_area"],
): Promise<NearbyPlace[]> {
  if (!googlePlacesApiKey) {
    throw new Error("Google Places is not configured for this environment.");
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googlePlacesApiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center,
            radius,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Places request failed (${response.status}).`);
  }

  const data = (await response.json()) as PlacesResponse;
  return (data.places ?? []).map((place) => ({
    placeId: place.id,
    name: place.displayName?.text ?? "Unnamed place",
    address: place.formattedAddress,
    location: place.location,
    types: place.types,
  }));
}
