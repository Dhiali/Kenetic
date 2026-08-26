# kenetic — React Native / Expo port

Ported from the Figma Make web prototype (React + Vite + Tailwind +
Framer Motion) to Expo + TypeScript, for use with Expo Go.

## Status: Phase 1 of 3

This phase covers the entire entry flow + home:

splash → fork (login/signup) → login/signup → intake carousel →
onboarding (fog reveal + finish ritual) → gateway → boundary prompt →
**dashboard** → **profile**

Screens for **focus / GSD / alien mode**, **breathe**, and **outdoors**
(camera-based bio radar, quizzes, spot finder, daily challenges) are
stubbed with a "coming soon" placeholder for now — those are next.

## Setup

This was built without network access, so dependencies haven't been
installed or run yet. On your machine:

```bash
cd kenetic
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Notes on the port

- **Framer Motion → react-native-reanimated + react-native-gesture-handler.**
  Every `drag`/`onDragEnd` interaction from the web build (flick to
  navigate, drag-to-agree, drag-to-edit, drag word into the "aura" to
  switch modes, etc.) has been rebuilt as a native `Gesture.Pan()`
  with matching distance thresholds.
- **`navigator.vibrate(...)` → `expo-haptics`.** Native haptics don't
  support arbitrary vibration patterns, so patterns are mapped to the
  closest `impactAsync`/`notificationAsync` call (see
  `src/utils/haptics.ts`).
- **Tailwind classes → StyleSheet.** Colors and spacing are carried
  over 1:1 in `src/theme/colors.ts`.
- **`backdrop-blur` / CSS blur** isn't available the same way in RN;
  screens that use it (fog reveal) approximate it with translucent
  overlays instead of true gaussian blur. `expo-blur`'s `<BlurView>`
  can be swapped in later if you want the real blur.
- **CSS `text-stroke`** (used for the ghost "FINISHED" outline text)
  has no RN equivalent — approximated with a dim solid color instead.
- The Dashboard's circular "wipe" transition is simplified to a
  static reveal rather than the exact 40x scale-up animation from
  the web version — functionally identical, visually close but not
  pixel-exact.

## Next phases

- **Phase 2:** Focus, GSD Setup/Tether/Penalty, Alien Mode
- **Phase 3:** Breathe (dashboard, setup, guided exercise, ritual),
  Outdoors (dashboard, Bio Radar w/ camera, Quizzes, Spot Finder,
  Daily Challenges)

Just say the word and I'll continue with the next phase.

## Alien Mode

Alien Mode uses deterministic local reframing so it works on Firebase's free
Spark plan and in Expo Go. It does not require an AI API key or Cloud Function.
The original task and the user's chosen micro-action are still stored in the
authenticated user's focus session record.
