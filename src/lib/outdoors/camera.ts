import {
    Camera,
    PermissionResponse,
    PermissionStatus,
} from "expo-camera";

export type CameraAccess = {
  camera: PermissionResponse;
  granted: boolean;
};

export async function getCameraAccess(): Promise<CameraAccess> {
  const camera = await Camera.getCameraPermissionsAsync();
  return {
    camera,
    granted: camera.status === PermissionStatus.GRANTED,
  };
}

export async function requestCameraAccess(): Promise<CameraAccess> {
  const current = await getCameraAccess();
  if (current.granted) return current;

  const camera =
    current.camera.status === PermissionStatus.GRANTED
      ? current.camera
      : await Camera.requestCameraPermissionsAsync();
  return {
    camera,
    granted: camera.status === PermissionStatus.GRANTED,
  };
}
