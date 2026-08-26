import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
    AppState,
    Linking,
    StyleSheet,
    Text,
    View,
    type AppStateStatus,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { finishFocusTether, startFocusTether } from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { colors } from "../theme/colors";

const DEADLINE_KEY = "@kenetic/focus-tether-deadline";
const SESSION_KEY = "@kenetic/focus-tether-session";
const PENDING_PLATFORM_KEY = "@kenetic/focus-tether-platform";
const PLANNED_MINUTES_KEY = "@kenetic/focus-tether-planned-minutes";
const SESSION_DEADLINE_KEY = "@kenetic/focus-session-deadline";
const TETHER_SECONDS = 120;
const SESSION_OPTIONS = [25, 45, 60, 90];

const triggerLauncherHaptic = () => {
  Haptics.selectionAsync().catch(() => undefined);
};

type PlatformChoice = "spotify" | "apple-music";
type ScreenState =
  | "setup"
  | "configure"
  | "handoff"
  | "session"
  | "complete"
  | "recenter";

export default function GsdSetupScreen({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<ScreenState>("setup");
  const [remaining, setRemaining] = useState(TETHER_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingPlatform, setPendingPlatform] = useState<PlatformChoice | null>(
    null,
  );
  const [tetherStarted, setTetherStarted] = useState(false);
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const pulse = useSharedValue(1);
  const orbOpacity = useSharedValue(0.32);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    orbOpacity.value = withRepeat(
      withSequence(
        withTiming(0.58, { duration: 1800 }),
        withTiming(0.32, { duration: 1800 }),
      ),
      -1,
      true,
    );

    let mounted = true;
    void restorePendingTether().then((pending) => {
      if (!mounted || !pending) return;
      setSessionId(pending.sessionId);
      setPendingPlatform(pending.platform);
      setTetherStarted(pending.started);
      setPlannedMinutes(pending.plannedMinutes);
      if (!pending.started) setState("configure");
      else if (pending.phase === "session") {
        setRemaining(pending.remaining);
        setState("session");
      } else if (pending.remaining <= 0) setState("recenter");
      else {
        setRemaining(pending.remaining);
        setState("handoff");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (state !== "handoff" && state !== "session") return;
    const tick = () => {
      const deadlineKey =
        state === "handoff" ? DEADLINE_KEY : SESSION_DEADLINE_KEY;
      void AsyncStorage.getItem(deadlineKey).then((value) => {
        if (!value) return;
        const deadline = Number(value);
        const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setRemaining(next);
        if (next === 0) {
          if (state === "handoff") {
            setState("setup");
            setError(
              "Your two-minute handoff ended. Set a new session to begin again.",
            );
            if (sessionId)
              void finishFocusTether(sessionId, TETHER_SECONDS, false).catch(
                () => undefined,
              );
            void clearSessionStorage();
          } else {
            setState("complete");
            if (sessionId)
              void finishFocusTether(
                sessionId,
                plannedMinutes * 60,
                true,
              ).catch(() => undefined);
            void AsyncStorage.multiRemove([
              SESSION_DEADLINE_KEY,
              SESSION_KEY,
              PENDING_PLATFORM_KEY,
              PLANNED_MINUTES_KEY,
            ]);
            setSessionId(null);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => undefined);
          }
        }
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state, sessionId]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (state !== "handoff") return;
      if (next !== "active") {
        void activateTether();
      } else {
        void restorePendingTether().then((pending) => {
          if (!pending || !pending.started) return;
          if (pending.remaining <= 0) {
            setState("setup");
            setError(
              "Your two-minute handoff ended. Set a new session to begin again.",
            );
            void AsyncStorage.multiRemove([
              DEADLINE_KEY,
              SESSION_KEY,
              PENDING_PLATFORM_KEY,
              PLANNED_MINUTES_KEY,
            ]);
          } else {
            void beginFocusSessionOnReturn(pending);
          }
        });
      }
    };
    const subscription = AppState.addEventListener("change", onAppState);
    return () => subscription.remove();
  }, [state]);

  const selectPlatform = async (platform: PlatformChoice) => {
    setError(null);
    await AsyncStorage.setItem(PENDING_PLATFORM_KEY, platform);
    await AsyncStorage.multiRemove([DEADLINE_KEY, SESSION_KEY]);
    setPendingPlatform(platform);
    setSessionId(null);
    setTetherStarted(false);
    setRemaining(TETHER_SECONDS);
    setState("configure");
    setPlannedMinutes(25);
  };

  const beginHandoff = async () => {
    if (!pendingPlatform) return;
    setError(null);
    await AsyncStorage.setItem(PLANNED_MINUTES_KEY, String(plannedMinutes));
    setState("handoff");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
      () => undefined,
    );

    const url = pendingPlatform === "spotify" ? "spotify://" : "music://";
    Linking.openURL(url).catch(() => {
      setError(
        `Could not open ${pendingPlatform === "spotify" ? "Spotify" : "Apple Music"}. Make sure it is installed.`,
      );
    });
  };

  const activateTether = async () => {
    const storedPlatform = await AsyncStorage.getItem(PENDING_PLATFORM_KEY);
    const platform =
      pendingPlatform ?? (storedPlatform as PlatformChoice | null);
    if (!platform || (await AsyncStorage.getItem(DEADLINE_KEY))) return;

    const deadline = Date.now() + TETHER_SECONDS * 1000;
    await AsyncStorage.setItem(DEADLINE_KEY, String(deadline));
    setTetherStarted(true);
    try {
      const nextSessionId = await startFocusTether(platform, plannedMinutes);
      setSessionId(nextSessionId);
      await AsyncStorage.setItem(SESSION_KEY, nextSessionId);
    } catch (launchError) {
      setError(firebaseErrorMessage(launchError));
    }
  };

  const completeRecenter = async () => {
    setError(null);
    if (!sessionId) {
      await clearSessionStorage();
      setState("setup");
      setPendingPlatform(null);
      setTetherStarted(false);
      setPlannedMinutes(25);
      setRemaining(TETHER_SECONDS);
      return;
    }
    try {
      await finishFocusTether(sessionId, TETHER_SECONDS, false);
      await AsyncStorage.multiRemove([
        DEADLINE_KEY,
        SESSION_KEY,
        PENDING_PLATFORM_KEY,
        PLANNED_MINUTES_KEY,
        SESSION_DEADLINE_KEY,
      ]);
      setState("setup");
      setRemaining(TETHER_SECONDS);
      setSessionId(null);
      setPendingPlatform(null);
      setTetherStarted(false);
      setPlannedMinutes(25);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (recenterError) {
      setError(firebaseErrorMessage(recenterError));
    }
  };

  const restartAfterRecenter = async () => {
    setError(null);
    try {
      if (sessionId) {
        await finishFocusTether(sessionId, 0, false);
      }
      await clearSessionStorage();
      setState("setup");
      setPendingPlatform(null);
      setSessionId(null);
      setTetherStarted(false);
      setPlannedMinutes(25);
      setRemaining(TETHER_SECONDS);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
    } catch (restartError) {
      setError(firebaseErrorMessage(restartError));
    }
  };

  const beginFocusSessionOnReturn = async (pending: {
    sessionId: string;
    remaining: number;
  }) => {
    const deadline = Date.now() + plannedMinutes * 60 * 1000;
    try {
      await AsyncStorage.setItem(SESSION_DEADLINE_KEY, String(deadline));
      await AsyncStorage.multiRemove([DEADLINE_KEY]);
      setRemaining(plannedMinutes * 60);
      setState("session");
      setTetherStarted(true);
    } catch (returnError) {
      setError(firebaseErrorMessage(returnError));
    }
  };

  const leaveSession = async () => {
    if (!sessionId) {
      onBack();
      return;
    }
    try {
      await finishFocusTether(
        sessionId,
        plannedMinutes * 60 - remaining,
        false,
      );
      await AsyncStorage.multiRemove([
        DEADLINE_KEY,
        SESSION_KEY,
        PENDING_PLATFORM_KEY,
        PLANNED_MINUTES_KEY,
        SESSION_DEADLINE_KEY,
      ]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => undefined,
      );
      onBack();
    } catch (leaveError) {
      setError(firebaseErrorMessage(leaveError));
    }
  };

  const exitToFocus = async () => {
    if (state === "handoff" || state === "session") {
      if (sessionId) {
        await finishFocusTether(
          sessionId,
          state === "session"
            ? Math.max(0, plannedMinutes * 60 - remaining)
            : 0,
          false,
        ).catch(() => undefined);
      }
      await clearSessionStorage();
    } else if (state === "configure" || state === "recenter") {
      await clearSessionStorage();
    }
    onBack();
  };

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: orbOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={styles.screen}
    >
      <View style={styles.content}>
        <GestureDetector
          gesture={Gesture.Pan().onEnd((event) => {
            if (event.translationX > 80) runOnJS(exitToFocus)();
          })}
        >
          <Text style={styles.nav}>← focus state.</Text>
        </GestureDetector>
        {state === "setup" && (
          <>
            <Text style={styles.title}>get shit done.</Text>
            <Text style={styles.subtitle}>
              Choose your sound tether. Drag it into the energy source to begin.
            </Text>
          </>
        )}
        {state === "configure" && (
          <>
            <Text style={styles.eyebrow}>sound tether</Text>
            <Text style={styles.title}>set your session.</Text>
            <Text style={styles.subtitle}>
              Choose how long you want to stay in focus before launching your
              music.
            </Text>
          </>
        )}
        {state === "handoff" && (
          <>
            <Text style={styles.eyebrow}>tether active</Text>
            <Text style={styles.title}>queue your sound.</Text>
            <Text style={styles.subtitle}>
              {tetherStarted
                ? "You have two minutes to choose your music, set the volume, and step away."
                : "Your tether begins when you leave Kenetic. Choose your music, then step away."}
            </Text>
          </>
        )}
        {state === "session" && (
          <>
            <Text style={styles.eyebrow}>focus in progress</Text>
            <Text style={styles.title}>stay with it.</Text>
            <Text style={styles.subtitle}>
              Your {plannedMinutes}-minute session is in progress. Leave when
              you are ready.
            </Text>
          </>
        )}
        {state === "complete" && (
          <>
            <Text style={styles.eyebrow}>session complete</Text>
            <Text style={styles.title}>congratulations.</Text>
            <Text style={styles.subtitle}>
              You completed your {plannedMinutes}-minute focus session.
            </Text>
          </>
        )}
        {state === "recenter" && (
          <>
            <Text style={styles.eyebrow}>tether expired</Text>
            <Text style={styles.title}>re-center.</Text>
            <Text style={styles.subtitle}>
              Place your phone face down for ten seconds, then choose your music
              again to restart your focus session.
            </Text>
          </>
        )}

        <View style={styles.orbArea}>
          <Animated.View style={[styles.orbGlow, orbStyle]} />
          <View style={styles.orb}>
            <Text style={styles.orbLabel}>
              {state === "handoff"
                ? tetherStarted
                  ? formatTime(remaining)
                  : "ready"
                : state === "session"
                  ? formatTime(remaining)
                  : state === "recenter"
                    ? "10 sec"
                    : state === "complete"
                      ? "done"
                      : "drop here"}
            </Text>
          </View>
        </View>

        {state === "setup" && (
          <View style={styles.launchers}>
            <Launcher
              label="open spotify ↗"
              color={colors.green}
              onLaunch={() => void selectPlatform("spotify")}
            />
            <Launcher
              label="open apple music ↗"
              color={colors.rose}
              onLaunch={() => void selectPlatform("apple-music")}
            />
          </View>
        )}
        {state === "configure" && (
          <View style={styles.configure}>
            <Text style={styles.configureLabel}>how long is this session?</Text>
            <View style={styles.sessionOptions}>
              {SESSION_OPTIONS.map((minutes) => (
                <Text
                  key={minutes}
                  onPress={() => setPlannedMinutes(minutes)}
                  style={[
                    styles.sessionOption,
                    plannedMinutes === minutes && styles.sessionOptionActive,
                  ]}
                >
                  {minutes}m
                </Text>
              ))}
            </View>
            <Text style={styles.selectedPlatform}>
              sound: {pendingPlatform === "spotify" ? "spotify" : "apple music"}
            </Text>
            <Text
              style={styles.beginAction}
              onPress={() => void beginHandoff()}
            >
              swipe right to begin →
            </Text>
          </View>
        )}
        {state === "handoff" && (
          <Text style={styles.status}>
            return to kenetic when you are ready.
          </Text>
        )}
        {state === "session" && (
          <Text style={styles.leaveAction} onPress={() => void leaveSession()}>
            leave session →
          </Text>
        )}
        {state === "complete" && (
          <Text style={styles.leaveAction} onPress={onBack}>
            return to focus state →
          </Text>
        )}
        {state === "recenter" && (
          <>
            <HoldToRecenter onComplete={() => void completeRecenter()} />
            <Text
              style={styles.restartAction}
              onPress={() => void restartAfterRecenter()}
            >
              restart session →
            </Text>
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Animated.View>
  );
}

function Launcher({
  label,
  color,
  onLaunch,
}: {
  label: string;
  color: string;
  onLaunch: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const gesture = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(1.04);
      runOnJS(triggerLauncherHaptic)();
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
    })
    .onEnd((event) => {
      if (event.translationY < -120) {
        x.value = withTiming(0, { duration: 260 });
        y.value = withTiming(-190, { duration: 260 });
        runOnJS(onLaunch)();
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
      scale.value = withSpring(1);
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.launcher, { borderColor: color }, style]}>
        <Text style={styles.launcherText}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

function HoldToRecenter({ onComplete }: { onComplete: () => void }) {
  const [seconds, setSeconds] = useState(10);
  const progress = useSharedValue(0);
  const gesture = Gesture.LongPress()
    .minDuration(10000)
    .onStart(() => {
      progress.value = withTiming(1, { duration: 10000 });
    })
    .onEnd((_event, success) => {
      if (success) runOnJS(onComplete)();
      else progress.value = withTiming(0, { duration: 250 });
    });
  const style = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
  }));
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.recenterTrack}>
        <Animated.View style={styles.recenterFill}>
          <Animated.View style={style} />
        </Animated.View>
        <Text style={styles.recenterText}>
          hold phone face down · {seconds}s
        </Text>
      </View>
    </GestureDetector>
  );
}

async function restorePendingTether() {
  const [
    deadlineValue,
    sessionDeadlineValue,
    sessionId,
    platform,
    plannedMinutesValue,
  ] = await AsyncStorage.multiGet([
    DEADLINE_KEY,
    SESSION_DEADLINE_KEY,
    SESSION_KEY,
    PENDING_PLATFORM_KEY,
    PLANNED_MINUTES_KEY,
  ]).then((entries) => entries.map(([, value]) => value));
  const deadline = Number(deadlineValue || sessionDeadlineValue);
  const plannedMinutes = Number(plannedMinutesValue) || 25;
  if (!platform || !deadline || !sessionId) {
    if (platform && !deadline) {
      return {
        platform: platform as PlatformChoice,
        sessionId: "",
        plannedMinutes,
        remaining: TETHER_SECONDS,
        started: false,
      };
    }
    return null;
  }
  return {
    sessionId,
    platform: platform as PlatformChoice,
    plannedMinutes,
    remaining: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    started: true,
    phase: sessionDeadlineValue ? "session" : "handoff",
  };
}

function clearSessionStorage() {
  return AsyncStorage.multiRemove([
    DEADLINE_KEY,
    SESSION_DEADLINE_KEY,
    SESSION_KEY,
    PENDING_PLATFORM_KEY,
    PLANNED_MINUTES_KEY,
  ]);
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark, overflow: "hidden" },
  content: { flex: 1, padding: 28, paddingTop: 54, paddingBottom: 42 },
  nav: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 34,
    marginBottom: 50,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  title: {
    color: colors.white,
    fontSize: 48,
    lineHeight: 50,
    fontWeight: "900",
    letterSpacing: -2,
  },
  subtitle: {
    color: colors.white50,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 330,
  },
  orbArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
  orbGlow: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.rose,
  },
  orb: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: colors.white30,
    backgroundColor: "rgba(18,18,18,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  orbLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  launchers: { gap: 12 },
  configure: { gap: 16 },
  configureLabel: {
    color: colors.white50,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sessionOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  sessionOption: {
    minWidth: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.white20,
    borderRadius: 24,
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  sessionOptionActive: {
    borderColor: colors.rose,
    backgroundColor: "rgba(225,29,72,0.18)",
  },
  selectedPlatform: {
    color: colors.white40,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  beginAction: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 4,
    textTransform: "uppercase",
  },
  launcher: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  launcherText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  status: {
    color: colors.white40,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 20,
  },
  leaveAction: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 22,
    textTransform: "uppercase",
  },
  restartAction: {
    color: colors.white50,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginTop: 18,
    textTransform: "uppercase",
  },
  recenterTrack: {
    height: 58,
    borderWidth: 1,
    borderColor: colors.white20,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  recenterFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22,163,74,0.22)",
  },
  recenterText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 16 },
});
