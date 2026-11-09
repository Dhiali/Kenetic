import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, FadeIn, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import SwipeAction from "../components/SwipeAction";
import { ensureAnonymousUser } from "../lib/firebase/auth";
import { finishFocusTether, startFocusTether } from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { focusRemainingSeconds, shouldStartFocus } from "../lib/focus/timing";
import { colors } from "../theme/colors";

const STORAGE_KEY = "@kenetic/focus-session-v2";
const SESSION_OPTIONS = [25, 45, 60, 90];
const storageKey = (uid: string) => `${STORAGE_KEY}/${uid}`;
type PlatformChoice = "spotify" | "apple-music";
type ScreenState = "setup" | "configure" | "handoff" | "session" | "complete";
type StoredSession = {
  uid: string;
  sessionId: string;
  platform: PlatformChoice;
  plannedMinutes: number;
  deadline: number | null;
};

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.uid === "string" && typeof record.sessionId === "string" &&
    (record.platform === "spotify" || record.platform === "apple-music") &&
    typeof record.plannedMinutes === "number" && SESSION_OPTIONS.includes(record.plannedMinutes) &&
    (record.deadline === null || (typeof record.deadline === "number" && Number.isFinite(record.deadline)));
}

export default function GsdSetupScreen({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<ScreenState>("setup");
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformChoice | null>(null);
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [busy, setBusy] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [readyToRetry, setReadyToRetry] = useState(false);
  const [retryTimer, setRetryTimer] = useState(false);
  const recordRef = useRef<StoredSession | null>(null);
  const busyRef = useRef(false);
  const handoffRef = useRef({ launched: false, left: false });
  const finishFailedRef = useRef(false);
  const appStateRef = useRef<string>(AppState.currentState || "unknown");
  const pulse = useSharedValue(1);
  const orbOpacity = useSharedValue(0.32);

  const lock = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };
  const unlock = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const startOnReturn = async () => {
    const record = recordRef.current;
    if (!record || record.deadline !== null ||
        !shouldStartFocus(handoffRef.current.launched, handoffRef.current.left, appStateRef.current) ||
        !lock()) return;
    const next = { ...record, deadline: Date.now() + record.plannedMinutes * 60_000 };
    try {
      await AsyncStorage.setItem(storageKey(record.uid), JSON.stringify(next));
      recordRef.current = next;
      handoffRef.current = { launched: false, left: false };
      setRemaining(focusRemainingSeconds(next.deadline, Date.now()));
      setState("session");
      setRetryTimer(false);
      setError(null);
    } catch (saveError) {
      setError(`Could not start the timer: ${firebaseErrorMessage(saveError)} Return to Kenetic and retry.`);
      setRetryTimer(true);
    } finally {
      unlock();
    }
  };
  const startOnReturnRef = useRef(startOnReturn);
  startOnReturnRef.current = startOnReturn;

  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1.1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
    ), -1, true);
    orbOpacity.value = withRepeat(withSequence(
      withTiming(0.58, { duration: 1800 }),
      withTiming(0.32, { duration: 1800 }),
    ), -1, true);
    let mounted = true;
    const restore = async () => {
      try {
        const user = await ensureAnonymousUser();
        const value = await AsyncStorage.getItem(storageKey(user.uid));
        if (!mounted || !value) return;
        const parsed: unknown = JSON.parse(value);
        if (!isStoredSession(parsed)) throw new Error("Saved focus session is invalid.");
        if (parsed.uid !== user.uid) return;
        recordRef.current = parsed;
        setPlatform(parsed.platform);
        setPlannedMinutes(parsed.plannedMinutes);
        if (parsed.deadline === null) {
          setState("handoff");
          setReadyToRetry(true);
        } else {
          setRemaining(focusRemainingSeconds(parsed.deadline, Date.now()));
          setState("session");
        }
      } catch (restoreError) {
        if (mounted) {
          setRestoreFailed(true);
          setError(`Could not restore the focus session: ${firebaseErrorMessage(restoreError)} Return to Focus and try again.`);
        }
      } finally {
        if (mounted) setBusy(false);
      }
    };
    void restore();
    const subscription = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
      if (next === "background" && recordRef.current?.deadline === null) handoffRef.current.left = true;
      if (next === "active") void startOnReturnRef.current();
    });
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const finishSession = async (completed: boolean) => {
    const record = recordRef.current;
    if (!record || !lock()) return;
    try {
      const secondsLeft = record.deadline === null ? record.plannedMinutes * 60 : focusRemainingSeconds(record.deadline, Date.now());
      await finishFocusTether(record.sessionId, record.plannedMinutes * 60 - secondsLeft, completed);
      await AsyncStorage.removeItem(storageKey(record.uid));
      recordRef.current = null;
      setError(null);
      if (completed) {
        setState("complete");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } else {
        onBack();
      }
    } catch (finishError) {
      finishFailedRef.current = true;
      setError(`Could not save your session: ${firebaseErrorMessage(finishError)} Please retry.`);
    } finally {
      unlock();
    }
  };
  const finishRef = useRef(finishSession);
  finishRef.current = finishSession;

  useEffect(() => {
    if (state !== "session") return;
    const tick = () => {
      const deadline = recordRef.current?.deadline;
      if (deadline == null) return;
      const seconds = focusRemainingSeconds(deadline, Date.now());
      setRemaining(seconds);
      if (seconds === 0 && !busyRef.current && !finishFailedRef.current) void finishRef.current(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state]);

  const openMusic = async (record: StoredSession) => {
    handoffRef.current = { launched: false, left: false };
    setReadyToRetry(false);
    setState("handoff");
    const url = record.platform === "spotify"
      ? "spotify://"
      : "music://music.apple.com/";
    try {
      await Linking.openURL(url);
      handoffRef.current.launched = true;
      setReadyToRetry(true);
    } catch {
      handoffRef.current = { launched: false, left: false };
      setReadyToRetry(true);
      setError(`Could not open ${record.platform === "spotify" ? "Spotify" : "Apple Music"}. Make sure it is installed and try again.`);
    }
  };

  const beginHandoff = async () => {
    if (!platform || !lock()) return;
    setError(null);
    try {
      const user = await ensureAnonymousUser();
      const sessionId = await startFocusTether(platform, plannedMinutes);
      const record: StoredSession = { uid: user.uid, sessionId, platform, plannedMinutes, deadline: null };
      recordRef.current = record;
      try {
        await AsyncStorage.setItem(storageKey(record.uid), JSON.stringify(record));
      } catch (saveError) {
        try {
          await finishFocusTether(sessionId, 0, false);
          recordRef.current = null;
        } catch (cleanupError) {
          setState("handoff");
          throw new Error(`Could not save the session locally or cancel it: ${firebaseErrorMessage(cleanupError)}`);
        }
        throw saveError;
      }
      await openMusic(record);
    } catch (startError) {
      setError(`Could not prepare your session: ${firebaseErrorMessage(startError)}`);
    } finally {
      unlock();
      void startOnReturnRef.current();
    }
  };

  const retryHandoff = async () => {
    const record = recordRef.current;
    if (!record || !lock()) return;
    setError(null);
    try {
      await openMusic(record);
    } finally {
      unlock();
      void startOnReturnRef.current();
    }
  };

  const exitToFocus = () => {
    if (busy) return;
    if (recordRef.current) {
      const deadline = recordRef.current.deadline;
      void finishSession(deadline !== null && focusRemainingSeconds(deadline, Date.now()) === 0);
    }
    else onBack();
  };
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: orbOpacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.duration(500)} exiting={FadeOut.duration(300)} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {state !== "session" && <SwipeAction label="back to focus" disabled={busy} onActivate={exitToFocus} />}
        {state === "setup" && <>
          <Text style={styles.title}>get shit done.</Text>
          <Text style={styles.subtitle}>Choose your sound tether. Drag it upward to set your session.</Text>
        </>}
        {state === "configure" && <>
          <Text style={styles.eyebrow}>GET SHIT DONE / SESSION SETUP</Text>
          <Text style={styles.title}>set your session.</Text>
          <Text style={styles.subtitle}>Choose your focus time, then open your music.</Text>
          <Text style={styles.timerNotice}>Your timer starts when you return to Kenetic.</Text>
        </>}
        {state === "handoff" && <>
          <Text style={styles.eyebrow}>sound tether</Text>
          <Text style={styles.title}>queue your sound.</Text>
          <Text style={styles.subtitle}>Choose your music, then return to Kenetic.</Text>
          <Text style={styles.timerNotice}>Your timer starts when you return to Kenetic.</Text>
        </>}
        {state === "session" && <>
          <Text style={styles.eyebrow}>focus in progress</Text>
          <Text style={styles.title}>stay with it.</Text>
          <Text style={styles.subtitle}>One moment at a time. Your focus session is underway.</Text>
          <View style={styles.activeTimerArea}>
            <Animated.View pointerEvents="none" style={[styles.activeTimerGlow, orbStyle]} />
            <View style={styles.activeTimer}>
              <Text style={styles.activeTimerCaption}>TIME REMAINING</Text>
              <Text
                accessibilityLabel={`${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds remaining`}
                style={styles.activeTimerValue}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {formatTime(remaining)}
              </Text>
              <Text style={styles.activeTimerDuration}>{plannedMinutes} MINUTE SESSION</Text>
            </View>
          </View>
        </>}
        {state === "complete" && <>
          <Text style={styles.eyebrow}>session complete</Text>
          <Text style={styles.title}>congratulations.</Text>
          <Text style={styles.subtitle}>You completed your {plannedMinutes}-minute focus session.</Text>
        </>}
        {state !== "configure" && state !== "session" && <View style={styles.orbArea}>
          <Animated.View style={[styles.orbGlow, orbStyle]} />
          <View style={styles.orb}>
            <Text style={styles.orbLabel}>{state === "complete" ? "done" : state === "handoff" ? "ready" : "focus"}</Text>
          </View>
        </View>}
        {state === "setup" && <View style={styles.launchers}>
          <Launcher label="choose spotify" color={colors.green} disabled={busy || restoreFailed} onLaunch={() => { setPlatform("spotify"); setPlannedMinutes(25); setState("configure"); setError(null); }} />
          <Launcher label="choose apple music" color={colors.rose} disabled={busy || restoreFailed} onLaunch={() => { setPlatform("apple-music"); setPlannedMinutes(25); setState("configure"); setError(null); }} />
        </View>}
        {state === "configure" && <View style={styles.configure}>
          <Text style={styles.configureLabel}>YOUR SOUND</Text>
          <Text style={styles.selectedPlatform}>{platform === "spotify" ? "Spotify" : "Apple Music"}</Text>
          <Text style={styles.configureLabel}>CHOOSE YOUR FOCUS TIME</Text>
          <Text style={styles.configureHint}>Drag a time to the right to select it.</Text>
          <View style={styles.sessionOptions}>
            {SESSION_OPTIONS.map((minutes) => (
              <DurationChoice
                key={minutes}
                minutes={minutes}
                selected={plannedMinutes === minutes}
                disabled={busy}
                onSelect={() => setPlannedMinutes(minutes)}
              />
            ))}
          </View>
          <Text style={styles.sessionSummary}>Ready for {plannedMinutes} minutes of focus.</Text>
          <SwipeAction label="open music" disabled={busy} onActivate={() => void beginHandoff()} />
        </View>}
        {state === "handoff" && retryTimer && <SwipeAction label="retry starting timer" disabled={busy} onActivate={() => void startOnReturn()} />}
        {state === "handoff" && readyToRetry && !retryTimer && <SwipeAction label="open music again" disabled={busy} onActivate={() => void retryHandoff()} />}
        {state === "session" && <View style={styles.activeActions}>
          <SwipeAction label={remaining === 0 ? "retry saving session" : "leave session"} disabled={busy} onActivate={() => void finishSession(remaining === 0)} />
        </View>}
        {state === "complete" && <SwipeAction label="return to focus state" onActivate={onBack} />}
        {busy && <Text style={styles.status}>please wait...</Text>}
        {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      </ScrollView>
    </Animated.View>
  );
}

function DurationChoice({ minutes, selected, disabled, onSelect }: {
  minutes: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const offset = useSharedValue(0);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      offset.value = Math.max(0, Math.min(20, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX >= 60) runOnJS(onSelect)();
    })
    .onFinalize(() => {
      offset.value = withSpring(0);
    });
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
  const label = `${minutes} minutes`;

  return (
    <View style={styles.sessionOption}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityHint="Drag right, or activate to select this duration."
          accessibilityState={{ disabled, selected }}
          accessibilityActions={[{ name: "activate", label: `Select ${label}` }]}
          onAccessibilityAction={(event) => {
            if (!disabled && event.nativeEvent.actionName === "activate") onSelect();
          }}
          onAccessibilityTap={() => { if (!disabled) onSelect(); }}
          style={[styles.durationChoice, selected && styles.durationSelected, disabled && styles.durationDisabled, dragStyle]}
        >
          <Text style={[styles.durationValue, selected && styles.durationValueSelected]}>
            {minutes}<Text style={styles.durationUnit}> min</Text>
          </Text>
          <Text style={styles.durationHint}>{selected ? "SELECTED" : "DRAG RIGHT →"}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Launcher({ label, color, disabled, onLaunch }: { label: string; color: string; disabled: boolean; onLaunch: () => void }) {
  const y = useSharedValue(0);
  const gesture = Gesture.Pan().enabled(!disabled)
    .onUpdate((event) => { y.value = Math.min(0, event.translationY); })
    .onEnd((event) => {
      if (event.translationY < -120) runOnJS(onLaunch)();
      y.value = withSpring(0);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <GestureDetector gesture={gesture}>
    <Animated.View accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityHint="Drag up, or activate to select." accessibilityState={{ disabled }}
      accessibilityActions={[{ name: "activate", label }]}
      onAccessibilityAction={(event) => { if (!disabled && event.nativeEvent.actionName === "activate") onLaunch(); }}
      onAccessibilityTap={() => { if (!disabled) onLaunch(); }}
      style={[styles.launcher, { borderColor: color }, style]}>
      <Text style={styles.launcherText}>{label} ↑</Text>
    </Animated.View>
  </GestureDetector>;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark, overflow: "hidden" },
  content: { flexGrow: 1, padding: 28, paddingTop: 104, paddingBottom: 60 },
  eyebrow: { color: "#ff9aaa", fontSize: 11, fontWeight: "800", letterSpacing: 2.2, textTransform: "uppercase", marginTop: 20, marginBottom: 12 },
  title: { color: colors.white, fontSize: 46, lineHeight: 49, fontWeight: "900", letterSpacing: -2, marginTop: 16 },
  subtitle: { color: "#d8cccf", fontSize: 16, lineHeight: 24, marginTop: 14, maxWidth: 330 },
  timerNotice: { color: "#ffe0e6", backgroundColor: "#572536", borderLeftWidth: 3, borderLeftColor: "#ff9aaa", borderRadius: 8, padding: 14, fontSize: 15, lineHeight: 22, fontWeight: "700", marginTop: 18 },
  orbArea: { flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: 230, marginVertical: 16 },
  orbGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: colors.rose },
  orb: { width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: "#e9768c", backgroundColor: "#21131a", alignItems: "center", justifyContent: "center" },
  orbLabel: { color: colors.white, fontSize: 23, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  activeTimerArea: { flexGrow: 1, minHeight: 280, alignItems: "center", justifyContent: "center", marginVertical: 24 },
  activeTimerGlow: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#a71e47" },
  activeTimer: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: "#d76b83", backgroundColor: "#21131a", alignItems: "center", justifyContent: "center", padding: 18 },
  activeTimerCaption: { color: "#e5bdc8", fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  activeTimerValue: { color: colors.white, fontSize: 52, fontWeight: "900", letterSpacing: -2, marginVertical: 8, fontVariant: ["tabular-nums"] },
  activeTimerDuration: { color: "#e5bdc8", fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  activeActions: { borderTopWidth: 1, borderTopColor: "#4b3038", paddingTop: 8 },
  launchers: { gap: 12 },
  configure: { marginTop: 32 },
  configureLabel: { color: "#ff9aaa", fontSize: 11, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  configureHint: { color: "#d8cccf", fontSize: 14, lineHeight: 21, marginTop: 8 },
  sessionOptions: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 12 },
  sessionOption: { width: "46%", flexGrow: 1 },
  durationChoice: { minHeight: 82, borderBottomWidth: 2, borderBottomColor: "#4b3038", paddingVertical: 8 },
  durationSelected: { borderBottomColor: "#ff9aaa" },
  durationDisabled: { opacity: 0.45 },
  durationValue: { color: "#e1cdd3", fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  durationValueSelected: { color: "#ff9aaa" },
  durationUnit: { fontSize: 14, fontWeight: "600", letterSpacing: 0 },
  durationHint: { color: "#c5b6ba", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 4 },
  selectedPlatform: { color: colors.white, fontSize: 22, fontWeight: "800", marginTop: 8, marginBottom: 28 },
  sessionSummary: { color: "#d8cccf", fontSize: 14, lineHeight: 21, marginTop: 22 },
  launcher: { minHeight: 64, borderWidth: 1, borderRadius: 20, backgroundColor: "#21161a", alignItems: "center", justifyContent: "center" },
  launcherText: { color: colors.white, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  status: { color: colors.white40, fontSize: 12, fontWeight: "700", marginTop: 12 },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 16 },
});
