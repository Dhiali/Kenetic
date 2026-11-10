import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Gyroscope } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
    AppState,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
    cancelAnimation,
    Easing,
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import {
    finishBreatheSession,
    startBreatheSession,
} from "../lib/firebase/bootstrap";
import { ensureAnonymousUser } from "../lib/firebase/auth";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { getBreathPhase } from "../lib/focus/breathing";
import { parseBreathingSession, type BreathingGuidance } from "../lib/focus/breathingSession";
import { createCompletionGate } from "../lib/focus/completionGate";
import { scopedSessionKey } from "../lib/focus/sessionStorage";
import SwipeAction from "../components/SwipeAction";
import { colors } from "../theme/colors";
import { capitalizeSentenceStarts } from "../utils/sentenceCase";

const SESSION_KEY = "@kenetic/breathe-session";
const DEADLINE_KEY = "@kenetic/breathe-deadline";
const EXERCISE_KEY = "@kenetic/breathe-exercise";
const DURATION_KEY = "@kenetic/breathe-duration";
const GUIDANCE_KEY = "@kenetic/breathe-guidance";

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
    description: "Inhale for four, hold for seven, exhale for eight.",
    duration: 300,
  },
  "clear-mind": {
    title: "Box breathing.",
    subtitle: "4-minute attention reset",
    accent: colors.green,
    description: "Inhale, hold, exhale, hold. Four counts each.",
    duration: 240,
  },
  "deep-relax": {
    title: "Body scan.",
    subtitle: "10-minute deep rest",
    accent: "#d6c3a5",
    description: "Let each part of the body soften without needing to sleep.",
    duration: 600,
  },
} as const;

type Exercise = keyof typeof protocols;
type Phase = "setup" | "active" | "paused" | "complete";

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
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("setup");
  const [guidance, setGuidance] = useState<BreathingGuidance>("flexible");
  const [breathName, setBreathName] = useState("Inhale");
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(protocol.duration);
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
  const circleScale = useSharedValue(1);
  const circleOpacity = useSharedValue(0.58);

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
      const keys = [SESSION_KEY, DEADLINE_KEY, EXERCISE_KEY, DURATION_KEY, GUIDANCE_KEY]
        .map((key) => scopedSessionKey(key, user.uid, exercise));
      const saved = await restoreSession(keys);
      if (!mounted) return;
      keysRef.current = keys;
      setRestoring(false);
      if (!saved) return;
      if (saved.exercise !== exercise) throw new Error("Saved breathing session does not match this exercise.");
      if (saved.duration !== protocol.duration) throw new Error("Saved breathing duration does not match this exercise.");
      setSessionId(saved.sessionId);
      setRemaining(saved.remaining);
      setGuidance(saved.guidance);
      setPhase("active");
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
    if (phase !== "active" && phase !== "paused") return;
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
        if (phase === "active") animateBreath(protocol.duration - next);
        if (next === 0) void complete();
      }).catch((readError) => setError(`Could not read the timer: ${firebaseErrorMessage(readError)}`));
    }, 250);
    return () => clearInterval(timer);
  }, [phase, protocol.duration]);

  useEffect(() => {
    if (phase === "paused") cancelAnimation(circleScale);
  }, [phase]);

  useEffect(() => {
    if (guidance !== "chest" || (phase !== "active" && phase !== "paused")) return;
    let subscription: { remove: () => void } | undefined;
    let mounted = true;
    void Gyroscope.isAvailableAsync().then((available) => {
      if (!mounted) return;
      if (!available) {
        setError("Motion sensing is unavailable. The timer continues without motion-sensitive guidance.");
        if (phase === "paused") setPhase("active");
        return;
      }
      Gyroscope.setUpdateInterval(250);
      subscription = Gyroscope.addListener(({ x, y, z }) => {
        const movement = Math.sqrt(x * x + y * y + z * z);
        const still = movement < 0.28;
        if (phase === "active" && !still) {
          setInterruptionCount((count) => count + 1);
          setPhase("paused");
        }
        if (phase === "paused" && still) {
          setPhase("active");
        }
      });
    }).catch((sensorError) => {
      if (mounted) {
        setError(`Could not access the motion sensor. The timer continues without motion-sensitive guidance: ${firebaseErrorMessage(sensorError)}`);
        if (phase === "paused") setPhase("active");
      }
    });
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [phase, guidance]);

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

  const activate = async () => {
    const keys = keysRef.current;
    if (startingRef.current || !keys || restoreFailed || restoring) return;
    setError(null);
    startingRef.current = true;
    setStarting(true);
    try {
      if (guidance === "chest" && !(await Gyroscope.isAvailableAsync())) {
        throw new Error("Motion sensing is unavailable. Choose flexible guidance to continue.");
      }
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
        [keys[4], guidance],
      ]);
      setSessionId(nextSessionId);
      setRemaining(protocol.duration);
      setPhase("active");
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (activateError) {
      setError(firebaseErrorMessage(activateError));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const animateBreath = (elapsed: number) => {
    const breath = getBreathPhase(exercise, elapsed);
    if (lastBreathPhase.current === breath.key) return;
    lastBreathPhase.current = breath.key;
    setBreathName(capitalizeSentenceStarts(breath.name));
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

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {phase === "setup" && <SwipeAction label="Back to breathe" disabled={starting} onActivate={onBack} />}
        {phase === "setup" && (
          <>
            <Text style={styles.eyebrow}>BREATHE / YOUR PRACTICE</Text>
            <Text style={styles.title}>{protocol.title}</Text>
            <Text style={styles.subtitle}>{protocol.subtitle}</Text>
            <View style={styles.infoCard}>
              <Text style={styles.cardLabel}>HOW IT WORKS</Text>
              <Text style={styles.cardText}>{protocol.description}</Text>
              <Text style={styles.cardNote}>Breathe gently and at a comfortable pace. Stop if you feel uncomfortable.</Text>
            </View>
            <Text style={styles.sectionLabel}>CHOOSE YOUR GUIDANCE</Text>
            <View style={styles.choiceCard}>
              <Text style={styles.choiceTitle}>Flexible guidance</Text>
              <Text style={styles.choiceText}>Hold or rest your phone comfortably. Follow the screen and gentle haptics.</Text>
              <Text style={styles.selected}>{guidance === "flexible" ? "SELECTED" : "AVAILABLE"}</Text>
              {guidance !== "flexible" && <SwipeAction label="Choose flexible guidance" disabled={starting} onActivate={() => { setGuidance("flexible"); setError(null); }} />}
            </View>
            <View style={styles.choiceCard}>
              <Text style={styles.choiceTitle}>Chest-based guidance</Text>
              <Text style={styles.choiceText}>Rest your phone on your chest. Movement pauses the cues; the timer keeps running.</Text>
              <Text style={styles.selected}>{guidance === "chest" ? "SELECTED" : "AVAILABLE"}</Text>
              {guidance !== "chest" && <SwipeAction label="Choose chest-based guidance" disabled={starting} onActivate={() => { setGuidance("chest"); setError(null); }} />}
            </View>
            {restoring ? <Text style={styles.cardNote}>Checking your saved session...</Text> : !restoreFailed && (
              <SwipeAction label={starting ? "Starting session..." : "Start breathing session"} disabled={starting} onActivate={() => void activate()} />
            )}
          </>
        )}
        {phase === "active" && (
          <>
            <Text style={styles.eyebrow}>BREATHE / SESSION IN PROGRESS</Text>
            <Text style={styles.title}>Stay with the rhythm.</Text>
            <Text style={styles.subtitle}>Follow along gently. You can take a break whenever you need.</Text>
          </>
        )}
        {phase === "paused" && (
          <>
            <Text style={styles.eyebrow}>BREATHE / GUIDANCE PAUSED</Text>
            <Text style={styles.title}>Find your position.</Text>
            <Text style={styles.subtitle}>Rest your phone to resume the cues. Your session timer is still running.</Text>
          </>
        )}
        {phase === "complete" && (
          <>
            <Text style={styles.eyebrow}>BREATHE / SESSION COMPLETE</Text>
            <Text style={styles.title}>Well done.</Text>
            <Text style={styles.subtitle}>You made time for yourself. Your session has been saved.</Text>
          </>
        )}
        {(phase === "active" || phase === "paused") && (
          <View style={styles.sessionCard}>
            <Text style={styles.cardLabel}>TIME REMAINING</Text>
            <Text style={styles.timer}>{formatTime(remaining)}</Text>
            <View style={styles.circleArea}>
              <Animated.View style={[styles.circleGlow, { backgroundColor: protocol.accent }, circleStyle]} />
              <View style={[styles.circle, { borderColor: protocol.accent }]}>
                <Text style={styles.circleText}>{phase === "paused" ? "Rest phone" : breathName}</Text>
              </View>
            </View>
            <Text style={styles.cardNote}>{guidance === "chest" ? "Chest-based guidance" : "Flexible guidance"}</Text>
          </View>
        )}
        {finishing && phase !== "complete" && <Text style={styles.cardNote}>Saving your session...</Text>}
        {completionFailed && (
          <SwipeAction label="Retry saving completed session" onActivate={() => void complete(true)} disabled={finishing} />
        )}
        {(phase === "active" || phase === "paused") && (
          <SwipeAction label={completionFailed ? "Return and retry later" : "Leave exercise"} disabled={finishing} onActivate={() => void leave()} />
        )}
        {phase === "complete" && (
          <SwipeAction label="Return to breathe state" onActivate={onBack} />
        )}
        {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      </ScrollView>
    </Animated.View>
  );
}

async function restoreSession(keys: string[]) {
  const values = await AsyncStorage.multiGet(
    keys,
  ).then((entries) => entries.map(([, value]) => value));
  return parseBreathingSession(values, Date.now());
}

function clearSessionStorage(keys: string[]) {
  return AsyncStorage.multiRemove(keys);
}
function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#100e0c" },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  eyebrow: {
    color: "#ffc18f",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 14,
  },
  title: {
    color: colors.white,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -2,
  },
  subtitle: {
    color: "#e5d3c7",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 330,
  },
  infoCard: { backgroundColor: "#3d241b", borderColor: "#89573e", borderWidth: 1, borderRadius: 22, padding: 20, marginTop: 26 },
  cardLabel: { color: "#ffc18f", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  cardText: { color: "#fff", fontSize: 16, lineHeight: 24, marginTop: 10 },
  cardNote: { color: "#e1cfc3", fontSize: 13, lineHeight: 20, marginTop: 12 },
  sectionLabel: { color: "#ffc18f", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 28, marginBottom: 12 },
  choiceCard: { backgroundColor: "#291a15", borderColor: "#80503b", borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 10 },
  choiceTitle: { color: "#fff", fontSize: 19, fontWeight: "800" },
  choiceText: { color: "#ead9cf", fontSize: 14, lineHeight: 21, marginTop: 8 },
  selected: { color: "#ffc18f", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 14 },
  sessionCard: { backgroundColor: "#291a15", borderColor: "#80503b", borderWidth: 1, borderRadius: 24, padding: 22, marginTop: 28, alignItems: "center" },
  circleArea: {
    alignItems: "center",
    justifyContent: "center",
    height: 260,
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
    textAlign: "center",
  },
  timer: {
    color: colors.white,
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: -3,
    marginTop: 12,
  },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 16 },
});
