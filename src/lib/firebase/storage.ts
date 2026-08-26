import { cloudinaryCloudName, cloudinaryUploadPreset } from "./config";

export async function uploadProfilePhoto(uid: string, uri: string) {
  if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error(
      "Cloudinary is not configured. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(
      "The selected photo could not be read. Please choose another photo.",
    );
  }
  const blob = await response.blob();
  const formData = new FormData();
  formData.append("file", blob, `${uid}-profile.jpg`);
  formData.append("upload_preset", cloudinaryUploadPreset);
  formData.append("folder", "kenetic/profile");

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
    { method: "POST", body: formData, headers: { Accept: "application/json" } },
  );
  if (!uploadResponse.ok) {
    let detail = "Profile photo upload failed. Please try again.";
    try {
      const errorBody = (await uploadResponse.json()) as {
        error?: { message?: string };
      };
      const cloudinaryMessage = errorBody.error?.message?.toLowerCase() ?? "";
      if (
        cloudinaryMessage.includes("unsigned") ||
        cloudinaryMessage.includes("upload preset")
      ) {
        detail =
          "Cloudinary upload preset must be set to unsigned. Check the preset in Cloudinary, then restart Expo.";
      }
    } catch {
      // Keep the user-facing fallback when Cloudinary does not return JSON.
    }
    throw new Error(detail);
  }

  const result = (await uploadResponse.json()) as { secure_url?: string };
  if (!result.secure_url) {
    throw new Error("Profile photo upload returned no image URL.");
  }
  return result.secure_url;
}
