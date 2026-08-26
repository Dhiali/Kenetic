import {
    Camera,
    CameraPermissionResponse,
    PermissionStatus,
} from "expo-camera";

export type CameraAccess = {
  camera: CameraPermissionResponse;
  microphone: CameraPermissionResponse;
  granted: boolean;
};

export async function getCameraAccess(): Promise<CameraAccess> {
  const [camera, microphone] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Camera.getMicrophonePermissionsAsync(),
  ]);
  return {
    camera,
    microphone,
    granted:
      camera.status === PermissionStatus.GRANTED &&
      microphone.status === PermissionStatus.GRANTED,
  };
}

export async function requestCameraAccess(): Promise<CameraAccess> {
  const current = await getCameraAccess();
  if (current.granted) return current;

  const camera =
    current.camera.status === PermissionStatus.GRANTED
      ? current.camera
      : await Camera.requestCameraPermissionsAsync();
  const microphone =
    current.microphone.status === PermissionStatus.GRANTED
      ? current.microphone
      : await Camera.requestMicrophonePermissionsAsync();

  return {
    camera,
    microphone,
    granted:
      camera.status === PermissionStatus.GRANTED &&
      microphone.status === PermissionStatus.GRANTED,
  };
}
