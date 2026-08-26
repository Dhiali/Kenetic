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
import { firebaseErrorMessage } from "../lib/firebase/errors";
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
  const [remaining, setRemaining] = useState(protocol.duration);
  const [sensorReady, setSensorReady] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const finishingRef = useRef(false);
  const lastBreathPhase = useRef<string | null>(null);
  const sessionStart = useRef<number | null>(null);
  const circleScale = useSharedValue(1);
  const circleOpacity = useSharedValue(0.58);
  const setupY = useSharedValue(0);

  const completePersistedSession = async (
    savedSessionId: string,
    duration: number,
    savedExercise: Exercise,
  ) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await finishBreatheSession(
        savedSessionId,
        duration,
        true,
        savedExercise,
        interruptionCount,
      );
      await clearSessionStorage();
      setSessionId(null);
      setPhase("complete");
    } catch (completeError) {
      setError(firebaseErrorMessage(completeError));
      finishingRef.current = false;
      setFinishing(false);
    }
  };

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
    void restoreSession().then((saved) => {
      if (!mounted || !saved || saved.exercise !== exercise) return;
      setSessionId(saved.sessionId);
      setRemaining(saved.remaining);
      if (saved.remaining <= 0) {
        void completePersistedSession(
          saved.sessionId,
          saved.duration,
          exercise,
        );
      } else {
        setPhase("active");
      }
      sessionStart.current = saved.startedAt;
    });
    return () => {
      mounted = false;
    };
  }, [exercise]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => {
      void AsyncStorage.getItem(DEADLINE_KEY).then((value) => {
        if (!value) return;
        const next = Math.max(
          0,
          Math.ceil((Number(value) - Date.now()) / 1000),
        );
        setRemaining(next);
        animateBreath(protocol.duration - next);
        if (next === 0) void complete();
      });
    }, 250);
    return () => clearInterval(timer);
  }, [phase, protocol.duration]);

  useEffect(() => {
    if (phase !== "ready" && phase !== "active" && phase !== "paused") return;
    let subscription: { remove: () => void } | undefined;
    let mounted = true;
    void Gyroscope.isAvailableAsync().then((available) => {
      if (!mounted || !available) {
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
    });
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [phase]);

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === "active" && (phase === "active" || phase === "paused"))
        void restoreSession().then((saved) => {
          if (saved && saved.exercise === exercise) {
            setRemaining(saved.remaining);
            if (saved.remaining <= 0) void complete();
          }
        });
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [phase, exercise]);

  const beginSetup = () => {
    setError(null);
    setPhase("ready");
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const activate = async () => {
    if (!sensorReady) {
      setError("Rest the phone flat on your chest to begin.");
      return;
    }
    setError(null);
    try {
      const nextSessionId = await startBreatheSession(
        exercise,
        protocol.duration,
      );
      const deadline = Date.now() + protocol.duration * 1000;
      await AsyncStorage.multiSet([
        [SESSION_KEY, nextSessionId],
        [DEADLINE_KEY, String(deadline)],
        [EXERCISE_KEY, exercise],
        [DURATION_KEY, String(protocol.duration)],
      ]);
      setSessionId(nextSessionId);
      sessionStart.current = Date.now();
      setRemaining(protocol.duration);
      setPhase("active");
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (activateError) {
      setError(firebaseErrorMessage(activateError));
    }
  };

  const animateBreath = (elapsed: number) => {
    const cycle = 13;
    const position = elapsed % cycle;
    const nextPhase =
      position < 4
        ? "primary-inhale"
        : position < 5
          ? "secondary-inhale"
          : position < 11
            ? "exhale"
            : "rest";
    const phaseChanged = lastBreathPhase.current !== nextPhase;
    lastBreathPhase.current = nextPhase;

    if (position < 4) {
      circleScale.value = withTiming(1.55, {
        duration: 4000,
        easing: Easing.inOut(Easing.ease),
      });
    } else if (position < 5) {
      circleScale.value = withTiming(2.05, { duration: 1000 });
      if (phaseChanged) triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    } else if (position < 11) {
      circleScale.value = withTiming(0.28, {
        duration: 6000,
        easing: Easing.out(Easing.ease),
      });
    } else {
      circleScale.value = withTiming(0.2, { duration: 2000 });
    }
  };

  const complete = async () => {
    if (finishingRef.current || !sessionId) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await finishBreatheSession(
        sessionId,
        protocol.duration,
        true,
        exercise,
        interruptionCount,
      );
      await clearSessionStorage();
      setPhase("complete");
      setSessionId(null);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy), 220);
      setTimeout(() => triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy), 440);
    } catch (completeError) {
      setError(firebaseErrorMessage(completeError));
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const leave = async () => {
    if (finishingRef.current) return;
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
      await clearSessionStorage();
      onBack();
    } catch (leaveError) {
      setError(firebaseErrorMessage(leaveError));
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const exitExercise = async () => {
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
        {phase === "setup" && (
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
        {phase === "active" && (
          <Text style={styles.leave} onPress={() => void leave()}>
            leave exercise →
          </Text>
        )}
        {phase === "paused" && (
          <Text style={styles.leave} onPress={() => void leave()}>
            leave exercise →
          </Text>
        )}
        {phase === "complete" && (
          <Text style={[styles.leave, styles.darkText]} onPress={onBack}>
            return to breathe state →
          </Text>
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

async function restoreSession() {
  const [sessionId, deadline, exercise, duration] = await AsyncStorage.multiGet(
    [SESSION_KEY, DEADLINE_KEY, EXERCISE_KEY, DURATION_KEY],
  ).then((entries) => entries.map(([, value]) => value));
  if (!sessionId || !deadline || !exercise) return null;
  return {
    sessionId,
    exercise,
    duration: Number(duration) || 180,
    startedAt: Number(deadline) - (Number(duration) || 180) * 1000,
    remaining: Math.max(0, Math.ceil((Number(deadline) - Date.now()) / 1000)),
  };
}

function clearSessionStorage() {
  return AsyncStorage.multiRemove([
    SESSION_KEY,
    DEADLINE_KEY,
    EXERCISE_KEY,
    DURATION_KEY,
  ]);
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
    ...StyleSheet.absoluteFillObject,
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
