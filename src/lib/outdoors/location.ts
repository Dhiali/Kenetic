import * as Location from "expo-location";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export async function requestForegroundLocation(): Promise<Coordinates | null> {
  const current = await Location.getForegroundPermissionsAsync();
  const permission =
    current.status === Location.PermissionStatus.GRANTED
      ? current
      : await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

export async function getLastKnownCoordinates(): Promise<Coordinates | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) return null;

  const position = await Location.getLastKnownPositionAsync();
  return position
    ? {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
    : null;
}
