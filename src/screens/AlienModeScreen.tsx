import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
    AppState,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
import {
    finishAlienModeSession,
    startAlienModeSession,
} from "../lib/firebase/bootstrap";
import { ensureAnonymousUser } from "../lib/firebase/auth";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { makeTaskSteps } from "../lib/ai/client";
import { useAiConsent } from "../lib/ai/useAiConsent";
import { scopedSessionKey } from "../lib/focus/sessionStorage";
import { createCompletionGate } from "../lib/focus/completionGate";
import AiConsent from "../components/AiConsent";
import AccessibleSwipeAction from "../components/SwipeAction";
import { colors } from "../theme/colors";

const ACTIVE_DEADLINE_KEY = "@kenetic/alien-mode-deadline";
const ACTIVE_SESSION_KEY = "@kenetic/alien-mode-session";
const TASK_KEY = "@kenetic/alien-mode-task";
const MICRO_ACTION_KEY = "@kenetic/alien-mode-micro-action";
const PROMPT_KEY = "@kenetic/alien-mode-prompt";
const ACTIVE_SECONDS = 30 * 60;

const triggerAlienHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => undefined);
};

type Phase = "confession" | "interception" | "ritual" | "active" | "complete";

export default function AlienModeScreen({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("confession");
  const [task, setTask] = useState("");
  const [microAction, setMicroAction] = useState("");
  const [isolatedFocus, setIsolatedFocus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(ACTIVE_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const finalizingRef = useRef(false);
  const completionGate = useRef(createCompletionGate()).current;
  const [completionFailed, setCompletionFailed] = useState(false);
  const keysRef = useRef<string[] | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const aiConsent = useAiConsent();
  const blob = useSharedValue(0);

  useEffect(() => {
    blob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    let mounted = true;
    void (async () => {
      const user = await ensureAnonymousUser();
      const keys = [ACTIVE_SESSION_KEY, ACTIVE_DEADLINE_KEY, TASK_KEY, MICRO_ACTION_KEY, PROMPT_KEY]
        .map((key) => scopedSessionKey(key, user.uid));
      if (!mounted) return;
      keysRef.current = keys;
      await restoreActiveSession(keys, () => mounted);
      if (mounted) setRestoring(false);
    })().catch((restoreError) => {
      if (!mounted) return;
      setRestoring(false);
      setRestoreFailed(true);
      setError(`Could not restore your focus session: ${firebaseErrorMessage(restoreError)} Return to Focus and try again.`);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (phase !== "active") return;
    const tick = () => {
      const keys = keysRef.current;
      if (!keys) return;
      void AsyncStorage.getItem(keys[1]).then((value) => {
        if (!value) return;
        const next = Math.max(
          0,
          Math.ceil((Number(value) - Date.now()) / 1000),
        );
        setRemaining(next);
        if (next === 0) void completeActiveSession();
      }).catch((readError) => setError(`Could not read the timer: ${firebaseErrorMessage(readError)}`));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, sessionId]);

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === "active" && phase === "active" && keysRef.current) {
        void restoreActiveSession(keysRef.current, () => true).catch((restoreError) =>
          setError(`Could not restore your focus session: ${firebaseErrorMessage(restoreError)}`),
        );
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [phase]);

  const blobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(blob.value, [0, 1], [20, -20]) },
      { scaleX: interpolate(blob.value, [0, 1], [1, 1.18]) },
      { scaleY: interpolate(blob.value, [0, 1], [1.1, 0.88]) },
      { rotate: `${interpolate(blob.value, [0, 1], [-4, 5])}deg` },
    ],
    borderRadius: interpolate(blob.value, [0, 1], [180, 120]),
  }));

  const surrender = async () => {
    if (generatingRef.current) return;
    if (!task.trim()) {
      setError("Name the task you are ready to make smaller.");
      return;
    }
    setError(null);
    if (task.length > 1000) {
      setError("Please keep your task under 1000 characters.");
      return;
    }
    generatingRef.current = true;
    setGenerating(true);
    try {
      const result = await makeTaskSteps(task.trim());
      setSteps(result.steps);
      setPrompt("Start with one small step.");
      setMicroAction(result.steps[0]);
      setPhase("interception");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    } catch (caught) {
      setError(firebaseErrorMessage(caught));
      void aiConsent.refresh();
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  };

  const isolate = () => {
    setError(null);
    setIsolatedFocus(microAction.trim());
    setPhase("ritual");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );
  };

  const begin = async () => {
    const keys = keysRef.current;
    if (startingRef.current || !keys || restoreFailed) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      const nextSessionId = await startAlienModeSession(
        task.trim(),
        isolatedFocus.trim(),
        prompt.trim(),
      );
      const deadline = Date.now() + ACTIVE_SECONDS * 1000;
      await AsyncStorage.multiSet([
        [keys[0], nextSessionId],
        [keys[1], String(deadline)],
        [keys[2], task.trim()],
        [keys[3], isolatedFocus.trim()],
        [keys[4], prompt.trim()],
      ]);
      setSessionId(nextSessionId);
      setRemaining(ACTIVE_SECONDS);
      setPhase("active");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
        () => undefined,
      );
    } catch (beginError) {
      setError(firebaseErrorMessage(beginError));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const completeActiveSession = async (retry = false) => {
    if (!sessionId || finalizingRef.current || !completionGate.start(retry)) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setCompletionFailed(false);
    setError(null);
    try {
      await finishAlienModeSession(sessionId, ACTIVE_SECONDS, true);
      if (keysRef.current) await clearAlienSessionStorage(keysRef.current);
      setPhase("complete");
      setSessionId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (completionError) {
      completionGate.fail();
      setCompletionFailed(true);
      setError(`Could not save your completed session: ${firebaseErrorMessage(completionError)}`);
      finalizingRef.current = false;
      setFinalizing(false);
    }
  };

  const leave = async () => {
    if (finalizingRef.current) return;
    if (completionFailed) {
      onBack();
      return;
    }
    finalizingRef.current = true;
    setFinalizing(true);
    try {
      if (sessionId) {
        await finishAlienModeSession(
          sessionId,
          ACTIVE_SECONDS - remaining,
          false,
        );
      }
      if (sessionId && keysRef.current) await clearAlienSessionStorage(keysRef.current);
      onBack();
    } catch (leaveError) {
      setError(firebaseErrorMessage(leaveError));
      finalizingRef.current = false;
      setFinalizing(false);
    }
  };

  const restoreActiveSession = async (keys: string[], isMounted: () => boolean) => {
    const [
      savedSession,
      savedDeadline,
      savedTask,
      savedMicroAction,
      savedPrompt,
    ] = await AsyncStorage.multiGet(keys).then((entries) => entries.map(([, value]) => value));
    if (!isMounted()) return;
    if ([savedSession, savedDeadline, savedTask, savedMicroAction, savedPrompt].every((value) => value === null)) return;
    if (!savedSession || !savedDeadline || !savedTask || !savedMicroAction || !savedPrompt) {
      throw new Error("Saved focus session is incomplete.");
    }
    if (!Number.isFinite(Number(savedDeadline))) throw new Error("Saved focus timer is invalid.");
    const next = Math.max(
      0,
      Math.ceil((Number(savedDeadline) - Date.now()) / 1000),
    );
    setSessionId(savedSession);
    if (savedTask) setTask(savedTask);
    if (savedMicroAction) {
      setMicroAction(savedMicroAction);
      setIsolatedFocus(savedMicroAction);
    }
    if (savedPrompt) setPrompt(savedPrompt);
    setRemaining(next);
    setPhase("active");
  };

  const renderConfession = () => (
    <>
      <Text style={styles.eyebrow}>ALIEN MODE / BREAK IT DOWN</Text>
      <Text style={styles.title}>what is looming?</Text>
      <TextInput
        accessibilityLabel="The task you want to break down"
        value={task}
        onChangeText={(value) => {
          setTask(value);
          setError(null);
        }}
        placeholder="type the overwhelming task..."
        placeholderTextColor={colors.white40}
        style={styles.input}
        multiline
      />
      <Text style={styles.subtitle}>If you start a focus session, your task and selected step are also saved to your Firebase account.</Text>
      {aiConsent.status === "loading" && <Text style={styles.subtitle}>Checking AI agreement...</Text>}
      {aiConsent.status === "not-agreed" && (
        <AiConsent disabled={aiConsent.saving} onAgree={() => void aiConsent.change(true)} />
      )}
      {aiConsent.status === "agreed" && (
        <>
          <Text style={styles.subtitle}>Your task will be sent to Gemini. Avoid personal or confidential details.</Text>
          <AccessibleSwipeAction label="send task and make steps" disabled={generating} onActivate={() => void surrender()} />
        </>
      )}
      {!!aiConsent.error && <Text style={styles.error}>{aiConsent.error}</Text>}
      {aiConsent.status === "error" && <AccessibleSwipeAction label="retry checking AI agreement" onActivate={() => void aiConsent.refresh()} />}
      {generating && <Text style={styles.subtitle}>Making your steps...</Text>}
    </>
  );

  const renderInterception = () => (
    <>
      <Text style={styles.eyebrow}>YOUR FIRST STEP</Text>
      <View style={styles.whiteCircle}>
        <Text style={styles.prompt}>{prompt}</Text>
        <Text style={styles.circleAction}>{microAction}</Text>
      </View>
      <Text style={styles.circleExplanation}>
        Your suggested steps:
      </Text>
      {steps.map((step, index) => <Text key={`${index}-${step}`} style={styles.circleExplanation}>{index + 1}. {step}</Text>)}
      <Text style={styles.circleExplanation}>The first step becomes your focus for the next 30 minutes. AI can make mistakes; review the steps first.</Text>
      <SwipeAction
        label="drag the focus up to isolate ↑"
        direction="up"
        onComplete={isolate}
        color={colors.white}
      />
    </>
  );

  const renderRitual = () => (
    <View style={styles.ritual}>
      <Text style={styles.ritualHeading}>YOUR ONLY FOCUS</Text>
      <Text style={styles.ritualPrompt}>{isolatedFocus}</Text>
      <BeginPuzzle onComplete={() => void begin()} />
      <AccessibleSwipeAction label={starting ? "starting session" : "begin focus session"} disabled={starting} onActivate={() => void begin()} />
    </View>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={[styles.screen, phase === "ritual" && styles.ritualScreen]}
    >
      <Animated.View style={[styles.weight, blobStyle]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[styles.content, styles.contentGrow]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          alwaysBounceVertical
          showsVerticalScrollIndicator={false}
        >
          <AccessibleSwipeAction label="back to focus" disabled={starting || finalizing} onActivate={onBack} />
          {restoring && <Text style={styles.subtitle}>Checking your saved session...</Text>}
          {phase === "confession" && !restoring && !restoreFailed && renderConfession()}
          {phase === "interception" && renderInterception()}
          {phase === "ritual" && renderRitual()}
          {phase === "active" && (
            <>
              <Text style={styles.eyebrow}>focus active</Text>
              <Text style={styles.title}>one thing.</Text>
              <Text style={styles.subtitle}>{isolatedFocus}</Text>
              <Text style={styles.timer}>{formatTime(remaining)}</Text>
              {completionFailed ? (
                <AccessibleSwipeAction label="retry saving completed session" disabled={finalizing} onActivate={() => void completeActiveSession(true)} />
              ) : (
                <AccessibleSwipeAction label="leave session" disabled={finalizing} onActivate={() => void leave()} />
              )}
            </>
          )}
          {phase === "complete" && (
            <>
              <Text style={styles.eyebrow}>focus complete</Text>
              <Text style={styles.title}>you stayed.</Text>
              <Text style={styles.subtitle}>
                The session was completed and logged.
              </Text>
              <AccessibleSwipeAction label="return to focus state" onActivate={onBack} />
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function SwipeAction({
  label,
  direction,
  onComplete,
  color,
  disabled = false,
}: {
  label: string;
  direction: "right" | "up";
  onComplete: () => void;
  color: string;
  disabled?: boolean;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      if (direction === "right")
        x.value = Math.max(0, Math.min(100, event.translationX));
      else y.value = Math.min(0, Math.max(-100, event.translationY));
    })
    .onEnd((event) => {
      const completed =
        direction === "right"
          ? event.translationX > 60
          : event.translationY < -60;
      if (completed) {
        runOnJS(triggerAlienHaptic)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onComplete)();
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.swipeHitArea, style]}>
        <Animated.Text style={[styles.swipe, { color }]}>{label}</Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}

function BeginPuzzle({ onComplete }: { onComplete: () => void }) {
  const translateY = useSharedValue(86);
  const scale = useSharedValue(1);
  const gesture = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(1.04);
      runOnJS(triggerAlienHaptic)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, Math.min(86, 86 + event.translationY));
    })
    .onEnd(() => {
      if (translateY.value < 42) {
        translateY.value = withSpring(0, { damping: 15, stiffness: 260 });
        runOnJS(triggerAlienHaptic)(Haptics.ImpactFeedbackStyle.Heavy);
        runOnJS(onComplete)();
      } else {
        translateY.value = withSpring(86, { damping: 14, stiffness: 190 });
      }
      scale.value = withSpring(1);
    });
  const activeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.beginPuzzle}>
      <Text style={styles.beginTarget}>BEGIN</Text>
      <GestureDetector gesture={gesture}>
        <Animated.Text style={[styles.beginActive, activeStyle]}>
          begin
        </Animated.Text>
      </GestureDetector>
    </View>
  );
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function clearAlienSessionStorage(keys: string[]) {
  return AsyncStorage.multiRemove(keys);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark, overflow: "hidden" },
  ritualScreen: { backgroundColor: colors.bgDark },
  keyboard: { flex: 1 },
  content: { padding: 28, paddingTop: 68, paddingBottom: 64 },
  contentGrow: { flexGrow: 1 },
  nav: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 34,
    marginBottom: 64,
  },
  ritualText: { color: colors.white },
  weight: {
    position: "absolute",
    bottom: -90,
    left: -60,
    width: 440,
    height: 380,
    backgroundColor: colors.rose,
    opacity: 0.34,
  },
  eyebrow: {
    color: "#ff9aaa",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 30,
    marginBottom: 14,
  },
  title: {
    color: colors.white,
    fontSize: 50,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  subtitle: {
    color: "#d8cccf",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 18,
    maxWidth: 330,
  },
  input: {
    color: colors.white,
    fontSize: 20,
    lineHeight: 28,
    borderWidth: 1,
    borderColor: "#713d4d",
    borderRadius: 18,
    backgroundColor: "#21161a",
    minHeight: 110,
    padding: 18,
    marginTop: 26,
    textAlignVertical: "top",
  },
  swipe: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 32,
  },
  swipeHitArea: {
    width: "100%",
    minHeight: 72,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  whiteCircle: {
    alignSelf: "stretch",
    minHeight: 160,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  prompt: {
    color: colors.textDark,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  circleAction: {
    color: colors.textDark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  circleExplanation: {
    color: "#e1d6d9",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "left",
    marginTop: 14,
  },
  ritual: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: 24,
  },
  ritualHeading: {
    width: "100%",
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2.4,
    textAlign: "left",
  },
  ritualPrompt: {
    width: "100%",
    color: colors.white,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    marginTop: 18,
    maxWidth: 330,
  },
  ritualLabel: {
    color: colors.white50,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    alignSelf: "flex-start",
  },
  action: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 28,
    maxWidth: 330,
  },
  ritualExplanation: {
    color: colors.white50,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 20,
  },
  beginPuzzle: {
    height: 150,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 60,
  },
  beginTarget: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
  },
  beginActive: {
    position: "absolute",
    top: 0,
    color: colors.green,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -2,
    textTransform: "lowercase",
  },
  timer: {
    color: colors.white,
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: -3,
    marginTop: 80,
  },
  leave: {
    color: colors.rose,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginTop: 28,
  },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 20 },
  suggestion: {
    color: colors.white40,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
});
