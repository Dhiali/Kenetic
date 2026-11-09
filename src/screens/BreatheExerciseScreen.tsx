import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Gyroscope } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
    AppState,
    StyleSheet,
    Text,
    View,
    type AppStateStatus,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    cancelAnimation,
    Easing,
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    finishBreatheSession,
    startBreatheSession,
} from "../lib/firebase/bootstrap";
import { ensureAnonymousUser } from "../lib/firebase/auth";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { getBreathPhase } from "../lib/focus/breathing";
import { createCompletionGate } from "../lib/focus/completionGate";
import { scopedSessionKey } from "../lib/focus/sessionStorage";
import SwipeAction from "../components/SwipeAction";
import { colors } from "../theme/colors";

const SESSION_KEY = "@kenetic/breathe-session";
const DEADLINE_KEY = "@kenetic/breathe-deadline";
const EXERCISE_KEY = "@kenetic/breathe-exercise";
const DURATION_KEY = "@kenetic/breathe-duration";

const protocols = {
  "calm-down": {
    title: "Physiological sigh.",
    subtitle: "3-minute panic offload",
    accent: colors.orange,
    description: "Two quick inhales, then one long slow exhale.",
    duration: 180,
  },
  recenter: {
    title: "4-7-8 grounding.",
    subtitle: "5-minute rhythmic reset",
    accent: colors.rose,
    description: "inhale for four, hold for seven, exhale for eight.",
    duration: 300,
  },
  "clear-mind": {
    title: "box breathing.",
    subtitle: "4-minute attention reset",
    accent: colors.green,
    description: "inhale, hold, exhale, hold. four counts each.",
    duration: 240,
  },
  "deep-relax": {
    title: "body scan.",
    subtitle: "10-minute deep rest",
    accent: "#d6c3a5",
    description: "let each part of the body soften without needing to sleep.",
    duration: 600,
  },
} as const;

type Exercise = keyof typeof protocols;
type Phase = "setup" | "ready" | "active" | "paused" | "complete";

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => undefined);
};

export default function BreatheExerciseScreen({
  exercise,
  onBack,
}: {
  exercise: Exercise;
  onBack: () => void;
}) {
  const protocol = protocols[exercise];
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(protocol.duration);
  const [sensorReady, setSensorReady] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [completionFailed, setCompletionFailed] = useState(false);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const finishingRef = useRef(false);
  const completionGate = useRef(createCompletionGate()).current;
  const startingRef = useRef(false);
  const keysRef = useRef<string[] | null>(null);
  const lastBreathPhase = useRef<string | null>(null);
  const sessionStart = useRef<number | null>(null);
  const circleScale = useSharedValue(1);
  const circleOpacity = useSharedValue(0.58);
  const setupY = useSharedValue(0);

  useEffect(() => {
    circleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1800 }),
        withTiming(0.58, { duration: 1800 }),
      ),
      -1,
      true,
    );
    let mounted = true;
    void (async () => {
      const user = await ensureAnonymousUser();
      const keys = [SESSION_KEY, DEADLINE_KEY, EXERCISE_KEY, DURATION_KEY]
        .map((key) => scopedSessionKey(key, user.uid, exercise));
      const saved = await restoreSession(keys);
      if (!mounted) return;
      keysRef.current = keys;
      setRestoring(false);
      if (!saved) return;
      if (saved.exercise !== exercise) throw new Error("Saved breathing session does not match this exercise.");
      setSessionId(saved.sessionId);
      setRemaining(saved.remaining);
      setPhase("active");
      sessionStart.current = saved.startedAt;
    })().catch((restoreError) => {
      if (!mounted) return;
      setRestoring(false);
      setRestoreFailed(true);
      setError(`Could not restore the breathing session: ${firebaseErrorMessage(restoreError)} Return to Breathe and try again.`);
    });
    return () => {
      mounted = false;
    };
  }, [exercise]);

  useEffect(() => {
    if (phase !== "active") return;
    lastBreathPhase.current = null;
    const timer = setInterval(() => {
      const keys = keysRef.current;
      if (!keys) return;
      void AsyncStorage.getItem(keys[1]).then((value) => {
        if (!value) return;
        const next = Math.max(
          0,
          Math.ceil((Number(value) - Date.now()) / 1000),
        );
        setRemaining(next);
        animateBreath(protocol.duration - next);
        if (next === 0) void complete();
      }).catch((readError) => setError(`Could not read the timer: ${firebaseErrorMessage(readError)}`));
    }, 250);
    return () => clearInterval(timer);
  }, [phase, protocol.duration]);

  useEffect(() => {
    if (phase === "paused") cancelAnimation(circleScale);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready" && phase !== "active" && phase !== "paused") return;
    let subscription: { remove: () => void } | undefined;
    let mounted = true;
    void Gyroscope.isAvailableAsync().then((available) => {
      if (!mounted) return;
      if (!available) {
        setSensorReady(true);
        return;
      }
      Gyroscope.setUpdateInterval(250);
      subscription = Gyroscope.addListener(({ x, y, z }) => {
        const movement = Math.sqrt(x * x + y * y + z * z);
        const still = movement < 0.28;
        setSensorReady(still);
        if (phase === "active" && !still) {
          setMotionDetected(true);
          setInterruptionCount((count) => count + 1);
          setPhase("paused");
        }
        if (phase === "paused" && still) {
          setMotionDetected(false);
          setPhase("active");
        }
      });
    }).catch((sensorError) => {
      if (mounted) setError(`Could not access the motion sensor: ${firebaseErrorMessage(sensorError)}`);
    });
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [phase]);

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === "active" && (phase === "active" || phase === "paused"))
        void (keysRef.current ? restoreSession(keysRef.current) : Promise.resolve(null)).then((saved) => {
          if (saved && saved.exercise === exercise) {
            setRemaining(saved.remaining);
            if (saved.remaining <= 0) void complete();
          }
        }).catch((restoreError) => setError(`Could not restore the timer: ${firebaseErrorMessage(restoreError)}`));
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [phase, exercise]);

  const beginSetup = () => {
    if (restoring || restoreFailed) return;
    setError(null);
    setPhase("ready");
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const activate = async () => {
    const keys = keysRef.current;
    if (startingRef.current || !keys || restoreFailed) return;
    if (!sensorReady) {
      setError("Rest the phone flat on your chest to begin.");
      return;
    }
    setError(null);
    startingRef.current = true;
    try {
      const nextSessionId = await startBreatheSession(
        exercise,
        protocol.duration,
      );
      const deadline = Date.now() + protocol.duration * 1000;
      await AsyncStorage.multiSet([
        [keys[0], nextSessionId],
        [keys[1], String(deadline)],
        [keys[2], exercise],
        [keys[3], String(protocol.duration)],
      ]);
      setSessionId(nextSessionId);
      sessionStart.current = Date.now();
      setRemaining(protocol.duration);
      setPhase("active");
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (activateError) {
      setError(firebaseErrorMessage(activateError));
    } finally {
      startingRef.current = false;
    }
  };

  const animateBreath = (elapsed: number) => {
    const breath = getBreathPhase(exercise, elapsed);
    if (lastBreathPhase.current === breath.key) return;
    lastBreathPhase.current = breath.key;
    circleScale.value = withTiming(breath.scale, {
      duration: breath.remainingSeconds * 1000,
      easing: Easing.inOut(Easing.ease),
    });
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const complete = async (retry = false) => {
    if (finishingRef.current || !sessionId || !completionGate.start(retry)) return;
    finishingRef.current = true;
    setFinishing(true);
    setCompletionFailed(false);
    setError(null);
    try {
      await finishBreatheSession(
        sessionId,
        protocol.duration,
        true,
        exercise,
        interruptionCount,
      );
      if (keysRef.current) await clearSessionStorage(keysRef.current);
      setPhase("complete");
      setSessionId(null);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy), 220);
      setTimeout(() => triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy), 440);
    } catch (completeError) {
      completionGate.fail();
      setCompletionFailed(true);
      setError(`Could not save your completed session: ${firebaseErrorMessage(completeError)}`);
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const leave = async () => {
    if (finishingRef.current || startingRef.current || restoring) return;
    if (completionFailed) {
      onBack();
      return;
    }
    finishingRef.current = true;
    try {
      if (sessionId) {
        await finishBreatheSession(
          sessionId,
          Math.max(0, protocol.duration - remaining),
          false,
          exercise,
          interruptionCount,
        );
      }
      if (sessionId && keysRef.current) await clearSessionStorage(keysRef.current);
      onBack();
    } catch (leaveError) {
      setError(firebaseErrorMessage(leaveError));
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const exitExercise = async () => {
    if (phase === "complete" || restoreFailed) {
      onBack();
      return;
    }
    await leave();
  };

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));
  const setupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: setupY.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={[styles.screen, phase === "complete" && styles.completeScreen]}
    >
      <View style={styles.content}>
        <GestureDetector
          gesture={Gesture.Pan().onEnd((event) => {
            if (event.translationX > 80) runOnJS(exitExercise)();
          })}
        >
          <Text style={[styles.nav, phase === "complete" && styles.darkText]}>
            ← state ledger.
          </Text>
        </GestureDetector>
        {phase === "setup" && (
          <>
            <Text style={styles.title}>{protocol.title}</Text>
            <Text style={styles.subtitle}>{protocol.subtitle}</Text>
            <Text style={styles.mandate}>{protocol.description}</Text>
          </>
        )}
        {phase === "ready" && (
          <>
            <Text style={styles.eyebrow}>place phone on chest</Text>
            <Text style={styles.title}>close your eyes.</Text>
            <Text style={styles.subtitle}>
              Follow the tactile rhythms. Once the phone is still, swipe up to
              begin the session.
            </Text>
          </>
        )}
        {phase === "active" && (
          <>
            <Text style={styles.eyebrow}>breathe active</Text>
            <Text style={styles.title}>stay with the rhythm.</Text>
            <Text style={styles.timer}>{formatTime(remaining)}</Text>
          </>
        )}
        {phase === "paused" && (
          <>
            <Text style={styles.eyebrow}>position lost</Text>
            <Text style={styles.title}>replace on chest.</Text>
            <Text style={styles.subtitle}>
              The haptics are paused. Rest the phone to resume.
            </Text>
          </>
        )}
        {phase === "complete" && (
          <>
            <Text style={[styles.eyebrow, styles.darkText]}>restored</Text>
            <Text style={[styles.title, styles.darkText]}>you returned.</Text>
            <Text style={[styles.subtitle, styles.darkText]}>
              Your {protocol.subtitle.toLowerCase()} is complete.
            </Text>
          </>
        )}
        <View style={styles.circleArea}>
          <Animated.View
            style={[
              styles.circleGlow,
              { backgroundColor: protocol.accent },
              circleStyle,
            ]}
          />
          <View style={[styles.circle, { borderColor: protocol.accent }]}>
            <Text
              style={[
                styles.circleText,
                phase === "complete" && styles.darkText,
              ]}
            >
              {phase === "complete"
                ? "CALM"
                : phase === "active"
                  ? "breathe"
                  : phase === "ready"
                    ? sensorReady
                      ? "ready"
                      : "rest phone"
                    : "begin"}
            </Text>
          </View>
        </View>
        {phase === "setup" && !restoring && !restoreFailed && !finishing && (
          <GestureDetector
            gesture={Gesture.Pan()
              .onUpdate((event) => {
                setupY.value = Math.min(0, Math.max(-100, event.translationY));
              })
              .onEnd((event) => {
                if (event.translationY < -60) {
                  setupY.value = withSpring(-100);
                  runOnJS(beginSetup)();
                } else setupY.value = withSpring(0);
              })}
          >
            <Animated.Text
              style={[
                styles.beginAction,
                { color: protocol.accent },
                setupStyle,
              ]}
            >
              drag up to setup ↑
            </Animated.Text>
          </GestureDetector>
        )}
        {completionFailed && (
          <SwipeAction label="retry saving completed session" onActivate={() => void complete(true)} disabled={finishing} />
        )}
        {(phase === "active" || phase === "paused") && !completionFailed && (
          <SwipeAction label="leave exercise" onActivate={() => void leave()} />
        )}
        {phase === "complete" && (
          <SwipeAction label="return to breathe state" onActivate={onBack} tone="light" />
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
      {phase === "ready" && (
        <GestureDetector
          gesture={Gesture.Pan()
            .activeOffsetY([-10, 10])
            .onEnd((event) => {
              if (event.translationY < -60) runOnJS(activate)();
            })}
        >
          <View style={styles.readyGestureOverlay} />
        </GestureDetector>
      )}
    </Animated.View>
  );
}

async function restoreSession(keys: string[]) {
  const [sessionId, deadline, exercise, duration] = await AsyncStorage.multiGet(
    keys,
  ).then((entries) => entries.map(([, value]) => value));
  if ([sessionId, deadline, exercise, duration].every((value) => value === null)) return null;
  if (!sessionId || !deadline || !exercise || !duration) throw new Error("Saved breathing session is incomplete.");
  if (!Number.isFinite(Number(deadline)) || !duration || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
    throw new Error("Saved breathing timer is invalid.");
  }
  return {
    sessionId,
    exercise,
    duration: Number(duration) || 180,
    startedAt: Number(deadline) - (Number(duration) || 180) * 1000,
    remaining: Math.max(0, Math.ceil((Number(deadline) - Date.now()) / 1000)),
  };
}

function clearSessionStorage(keys: string[]) {
  return AsyncStorage.multiRemove(keys);
}
function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark, overflow: "hidden" },
  completeScreen: { backgroundColor: colors.bgLight },
  content: { flex: 1, padding: 28, paddingTop: 54, paddingBottom: 42 },
  nav: {
    color: colors.orange,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 34,
    marginBottom: 54,
  },
  darkText: { color: colors.textDark },
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
  mandate: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 38,
    maxWidth: 300,
  },
  circleArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 250,
  },
  circleGlow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: 0.35,
  },
  circle: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  beginAction: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingVertical: 20,
  },
  readyGestureOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  timer: {
    color: colors.white,
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: -3,
    marginTop: 12,
  },
  leave: {
    color: colors.rose,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 22,
  },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 16 },
});
