# Outdoor Analysis Plan

## Current Expo Go Phase

The app does not install a native ML Kit package. Outdoor scanning must remain usable without native ML:

- `expo-camera` provides the camera preview and capture flow.
- Location and Google Places are handled by the existing outdoor services.
- The app stores structured scan results, coordinates, timestamps, and ecological metadata only.
- Captured images and audio remain local and are not uploaded.
- The analyzer returns an explicit unavailable result until an analysis provider is configured.

## Capability Decision

- On-device image labeling: useful for broad labels such as plant, bird, or tree; not sufficient for reliable species identification.
- Object detection: optional later for locating objects in a frame.
- Text recognition: not needed for the first outdoor scanner.
- Barcode scanning: not part of the outdoor feature.
- Custom model inference: likely needed later for species-level identification.
- Cloud AI analysis: optional later for ecological significance and richer explanations; it must use a secure backend proxy.

## Development-Build Phase

When native analysis is approved, create an Expo development build first. Verify the exact package and Expo SDK 54 compatibility before installation. Native ML libraries cannot be assumed to work in Expo Go.

The native implementation should sit behind the analyzer interface so screens do not change when the provider changes:

1. Capture an image with `expo-camera`.
2. Pass the local image to an on-device analyzer when available.
3. Use a custom model or secure cloud analysis for species-level results.
4. Save only the structured result through Firestore.
5. Keep raw media local unless a separate storage decision is approved.

## Backend Boundary

Cloud analysis and API keys must not be called with privileged credentials from the app. If cloud analysis is added later, route it through a secure backend service. Firebase Cloud Functions are deferred while the project remains on the Spark plan.
