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
import { capitalizeSentenceStarts } from "../utils/sentenceCase";
import { makeTaskSteps } from "../lib/ai/client";
import { useAiConsent } from "../lib/ai/useAiConsent";
import { scopedSessionKey } from "../lib/focus/sessionStorage";
import { createCompletionGate } from "../lib/focus/completionGate";
import { alienElapsedSeconds, parseAlienPlan, type AlienPlan } from "../lib/focus/alienPlan";
import AiConsent from "../components/AiConsent";
import AccessibleSwipeAction from "../components/SwipeAction";
import { colors } from "../theme/colors";

const ACTIVE_DEADLINE_KEY = "@kenetic/alien-mode-deadline";
const ACTIVE_SESSION_KEY = "@kenetic/alien-mode-session";
const TASK_KEY = "@kenetic/alien-mode-task";
const MICRO_ACTION_KEY = "@kenetic/alien-mode-micro-action";
const PROMPT_KEY = "@kenetic/alien-mode-prompt";
const PLAN_KEY = "@kenetic/alien-mode-plan";
const LEGACY_SECONDS = 30 * 60;
const DEFAULT_MINUTES = 5;

const triggerAlienHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => undefined);
};

type Phase = "confession" | "interception" | "active" | "complete";

export default function AlienModeScreen({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("confession");
  const [task, setTask] = useState("");
  const [microAction, setMicroAction] = useState("");
  const [isolatedFocus, setIsolatedFocus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_MINUTES * 60);
  const deadlineRef = useRef<number | null>(null);
  const completionDurationRef = useRef<number | null>(null);
  const planRef = useRef<AlienPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DEFAULT_MINUTES * 60);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const finalizingRef = useRef(false);
  const completionGate = useRef(createCompletionGate());
  const [completionFailed, setCompletionFailed] = useState(false);
  const keysRef = useRef<string[] | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const aiConsent = useAiConsent();
  const blob = useSharedValue(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [phase]);

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
      const keys = [ACTIVE_SESSION_KEY, ACTIVE_DEADLINE_KEY, TASK_KEY, MICRO_ACTION_KEY, PROMPT_KEY, PLAN_KEY]
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
      if (next === "active" && phase === "active" && keysRef.current && !finalizingRef.current) {
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
      setStepIndex(0);
      setMinutes(DEFAULT_MINUTES);
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

  const begin = async () => {
    const keys = keysRef.current;
    if (startingRef.current || !keys || restoreFailed) return;
    const focus = microAction.trim();
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      const seconds = minutes * 60;
      const plan: AlienPlan = { task: task.trim(), prompt: prompt.trim(), steps, index: stepIndex, durationSeconds: seconds, status: "active" };
      const nextSessionId = await startAlienModeSession(
        task.trim(),
        focus,
        prompt.trim(),
      );
      const deadline = Date.now() + seconds * 1000;
      await AsyncStorage.multiSet([
        [keys[0], nextSessionId],
        [keys[1], String(deadline)],
        [keys[2], task.trim()],
        [keys[3], focus],
        [keys[4], prompt.trim()],
        [keys[5], JSON.stringify(plan)],
      ]);
      planRef.current = plan;
      deadlineRef.current = deadline;
      completionDurationRef.current = null;
      completionGate.current = createCompletionGate();
      setSessionId(nextSessionId);
      setIsolatedFocus(focus);
      setDurationSeconds(seconds);
      setRemaining(seconds);
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
    if (!sessionId || finalizingRef.current || !completionGate.current.start(retry)) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setCompletionFailed(false);
    setError(null);
    if (completionDurationRef.current === null) {
      completionDurationRef.current = deadlineRef.current === null
        ? durationSeconds - remaining
        : alienElapsedSeconds(deadlineRef.current, durationSeconds, Date.now());
    }
    try {
      await finishAlienModeSession(sessionId, completionDurationRef.current, true);
      if (keysRef.current) {
        if (planRef.current) {
          const completedPlan: AlienPlan = { ...planRef.current, status: "complete" };
          await AsyncStorage.setItem(keysRef.current[5], JSON.stringify(completedPlan));
          planRef.current = completedPlan;
        }
        await clearAlienSessionStorage(keysRef.current.slice(0, 5));
      }
      setPhase("complete");
      setSessionId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (completionError) {
      completionGate.current.fail();
      setCompletionFailed(true);
      setError(`Could not save your completed session: ${firebaseErrorMessage(completionError)}`);
    } finally {
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
          deadlineRef.current === null ? durationSeconds - remaining : alienElapsedSeconds(deadlineRef.current, durationSeconds, Date.now()),
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

  const reviewNextStep = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) return;
    setStepIndex(nextIndex);
    setMicroAction(steps[nextIndex]);
    setMinutes(DEFAULT_MINUTES);
    setError(null);
    setPhase("interception");
  };

  const startNewTask = async () => {
    if (finalizingRef.current || !keysRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setError(null);
    try {
      await AsyncStorage.removeItem(keysRef.current[5]);
      planRef.current = null;
      setTask("");
      setSteps([]);
      setStepIndex(0);
      setMicroAction("");
      setIsolatedFocus("");
      setPrompt("");
      setMinutes(DEFAULT_MINUTES);
      setPhase("confession");
    } catch (clearError) {
      setError(`Could not clear the saved focus plan: ${firebaseErrorMessage(clearError)}`);
    } finally {
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
      savedPlan,
    ] = await AsyncStorage.multiGet(keys).then((entries) => entries.map(([, value]) => value));
    if (!isMounted()) return;
    const plan = savedPlan ? parseAlienPlan(savedPlan) : null;
    const noActiveSession = [savedSession, savedDeadline, savedTask, savedMicroAction, savedPrompt].every((value) => value === null);
    if (noActiveSession) {
      if (!plan) return;
      if (plan.status !== "complete") throw new Error("Saved focus session is incomplete.");
      planRef.current = plan;
      setTask(plan.task);
      setPrompt(plan.prompt);
      setSteps(plan.steps);
      setStepIndex(plan.index);
      setMicroAction(plan.steps[plan.index]);
      setIsolatedFocus(plan.steps[plan.index]);
      setDurationSeconds(plan.durationSeconds);
      setPhase("complete");
      return;
    }
    if (!savedSession || !savedDeadline || !savedTask || !savedMicroAction || !savedPrompt) {
      throw new Error("Saved focus session is incomplete.");
    }
    if (!Number.isFinite(Number(savedDeadline))) throw new Error("Saved focus timer is invalid.");
    if (plan && (plan.task !== savedTask || plan.prompt !== savedPrompt || plan.steps[plan.index] !== savedMicroAction)) {
      throw new Error("Saved focus plan does not match the session.");
    }
    planRef.current = plan;
    if (deadlineRef.current !== Number(savedDeadline)) completionDurationRef.current = null;
    deadlineRef.current = Number(savedDeadline);
    setDurationSeconds(plan ? plan.durationSeconds : LEGACY_SECONDS);
    if (plan) {
      setSteps(plan.steps);
      setStepIndex(plan.index);
      setMinutes(plan.durationSeconds / 60);
    }
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
      <Text style={styles.title}>What is looming?</Text>
      <TextInput
        accessibilityLabel="The task you want to break down"
        value={task}
        onChangeText={(value) => {
          setTask(value);
          setError(null);
        }}
        placeholder="Type the overwhelming task..."
        placeholderTextColor={colors.white40}
        style={styles.input}
        multiline
      />
      {aiConsent.status === "loading" && <Text style={styles.subtitle}>Checking AI agreement...</Text>}
      {aiConsent.status === "not-agreed" && (
        <AiConsent disabled={aiConsent.saving} onAgree={() => void aiConsent.change(true)} />
      )}
      {aiConsent.status === "agreed" && (
        <>
          <Text style={styles.subtitle}>Your task will be sent to Gemini. Avoid personal or confidential details.</Text>
          <AccessibleSwipeAction label="Send task and make steps" disabled={generating} onActivate={() => void surrender()} />
        </>
      )}
      {!!aiConsent.error && <Text style={styles.error}>{aiConsent.error}</Text>}
      {aiConsent.status === "error" && <AccessibleSwipeAction label="Retry checking AI agreement" onActivate={() => void aiConsent.refresh()} />}
      {generating && <Text style={styles.subtitle}>Making your steps...</Text>}
    </>
  );

  const renderInterception = () => (
    <>
      <Text style={styles.eyebrow}>ALIEN MODE / YOUR {stepIndex === 0 ? "FIRST" : "NEXT"} STEP</Text>
      <Text style={styles.stepTitle}>{stepIndex === 0 ? "Start small." : "Keep going."}</Text>
      <Text style={styles.stepIntro}>One step is all you need to focus on right now.</Text>
      <View style={styles.focusCard}>
        <View style={styles.focusCardHeader}>
          <Text style={styles.focusCardLabel}>YOUR {stepIndex === 0 ? "FIRST" : "NEXT"} STEP</Text>
          <Text style={styles.focusCardNumber}>{String(stepIndex + 1).padStart(2, "0")}</Text>
        </View>
        <Text style={styles.focusCardAction}>{capitalizeSentenceStarts(microAction)}</Text>
        <View style={styles.focusCardFooter}>
          <Text style={styles.focusCardFooterText}>YOUR FOCUS</Text>
          <Text style={styles.focusCardFooterText}>{minutes} MIN</Text>
        </View>
      </View>
      {steps.length > stepIndex + 1 && (
        <View style={styles.nextSteps}>
          <Text style={styles.nextStepsLabel}>THE STEPS AFTER THAT</Text>
          {steps.slice(stepIndex + 1).map((step, index) => (
            <View key={`${index + stepIndex + 1}-${step}`} style={styles.nextStepRow}>
              <Text style={styles.nextStepNumber}>{String(index + stepIndex + 2).padStart(2, "0")}</Text>
              <Text style={styles.nextStepText}>{capitalizeSentenceStarts(step)}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.durationSection}>
        <Text style={styles.nextStepsLabel}>CHOOSE YOUR FOCUS TIME</Text>
        <Text style={styles.durationHint}>Drag a time right to select it. Up to 10 minutes per step.</Text>
        <View style={styles.durationOptions}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((option) => (
            <DurationChoice key={option} minutes={option} selected={minutes === option} disabled={starting} onSelect={() => setMinutes(option)} />
          ))}
        </View>
      </View>
      <Text style={styles.stepDisclaimer}>AI can make mistakes. Review your steps before you begin. The timer starts when you drag up.</Text>
      <SwipeAction
        label={starting ? "Starting session..." : `Start ${minutes}-minute session`}
        onComplete={() => void begin()}
        color={colors.white}
        disabled={starting}
      />
    </>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={styles.screen}
    >
      <Animated.View style={[styles.weight, blobStyle]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, styles.contentGrow]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          alwaysBounceVertical
          showsVerticalScrollIndicator={false}
        >
          {phase === "confession" && (
            <AccessibleSwipeAction label="Back to focus" disabled={starting || finalizing} onActivate={onBack} />
          )}
          {restoring && <Text style={styles.subtitle}>Checking your saved session...</Text>}
          {phase === "confession" && !restoring && !restoreFailed && renderConfession()}
          {phase === "interception" && renderInterception()}
          {phase === "active" && (
            <>
              <Text style={styles.eyebrow}>ALIEN MODE / FOCUS ACTIVE</Text>
              <Text style={styles.title}>One thing.</Text>
              <Text style={styles.sessionIntro}>You have made a start. Stay with this one step.</Text>
              <View style={styles.activeFocusCard}>
                <Text style={styles.activeFocusLabel}>YOUR FOCUS</Text>
                <Text style={styles.activeFocusText}>{capitalizeSentenceStarts(isolatedFocus)}</Text>
              </View>
              <View style={styles.timerCard}>
                <Text style={styles.timerCaption}>TIME REMAINING</Text>
                <Text
                  accessibilityLabel={`${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds remaining`}
                  style={styles.timer}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {formatTime(remaining)}
                </Text>
                <Text style={styles.timerDuration}>{durationSeconds / 60} MINUTE SESSION</Text>
              </View>
              <View style={styles.sessionAction}>
                {completionFailed ? (
                  <AccessibleSwipeAction label="Retry saving completed session" disabled={finalizing} onActivate={() => void completeActiveSession(true)} />
                ) : (
                  <>
                    <AccessibleSwipeAction label="Finish this step" disabled={finalizing} onActivate={() => void completeActiveSession()} />
                    <AccessibleSwipeAction label="Leave session" disabled={finalizing} onActivate={() => void leave()} />
                  </>
                )}
              </View>
            </>
          )}
          {phase === "complete" && (
            <>
              <Text style={styles.eyebrow}>ALIEN MODE / FOCUS COMPLETE</Text>
              <Text style={styles.title}>Focus finished.</Text>
              <Text style={styles.sessionIntro}>Your focus session is complete. Take a moment before moving on.</Text>
              <View style={styles.activeFocusCard}>
                <Text style={styles.activeFocusLabel}>YOUR COMPLETED SESSION</Text>
                <Text style={styles.activeFocusText}>{capitalizeSentenceStarts(isolatedFocus)}</Text>
              </View>
              <Text style={styles.completionNote}>Your session has been saved.</Text>
              <View style={styles.sessionAction}>
                {stepIndex + 1 < steps.length && (
                  <AccessibleSwipeAction label="Review next step" disabled={finalizing} onActivate={reviewNextStep} />
                )}
                <AccessibleSwipeAction label="Start a new task" disabled={finalizing} onActivate={() => void startNewTask()} />
                <AccessibleSwipeAction label="Return to focus state" disabled={finalizing} onActivate={onBack} />
              </View>
            </>
          )}
          {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
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
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const label = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

  return (
    <View style={styles.durationCell}>
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
          style={[styles.durationChoice, selected && styles.durationSelected, disabled && styles.swipeDisabled, animatedStyle]}
        >
          <Text style={[styles.durationValue, selected && styles.durationValueSelected]}>{minutes}</Text>
          <Text style={[styles.durationUnit, selected && styles.durationValueSelected]}>MIN</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function SwipeAction({
  label,
  onComplete,
  color,
  disabled = false,
}: {
  label: string;
  onComplete: () => void;
  color: string;
  disabled?: boolean;
}) {
  const y = useSharedValue(0);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      y.value = Math.min(0, Math.max(-100, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY < -60) {
        runOnJS(triggerAlienHaptic)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onComplete)();
      }
    })
    .onFinalize(() => {
      y.value = withSpring(0);
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint="Drag up to activate, or use the activate accessibility action."
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate", label: `Activate ${label}` }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === "activate") onComplete();
        }}
        onAccessibilityTap={() => {
          if (!disabled) onComplete();
        }}
        style={[styles.swipeHitArea, disabled && styles.swipeDisabled, style]}
      >
        <Animated.Text style={[styles.swipe, { color }]}>{label}</Animated.Text>
        <Text style={styles.swipeHint}>{disabled ? "PLEASE WAIT" : "DRAG UP ↑"}</Text>
      </Animated.View>
    </GestureDetector>
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
  keyboard: { flex: 1 },
  content: { padding: 28, paddingTop: 104, paddingBottom: 64 },
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
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  swipeHitArea: {
    width: "100%",
    minHeight: 76,
    padding: 18,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#e97f94",
    borderRadius: 18,
    backgroundColor: "#401a28",
    alignItems: "center",
    justifyContent: "center",
  },
  swipeDisabled: { opacity: 0.6 },
  swipeHint: {
    color: "#ffb6c4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginTop: 7,
  },
  stepTitle: {
    color: colors.white,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  stepIntro: {
    color: "#d8cccf",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 320,
  },
  focusCard: {
    backgroundColor: "#f6e8eb",
    borderRadius: 24,
    padding: 22,
    marginTop: 24,
  },
  focusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  focusCardLabel: {
    color: "#8c3d50",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  focusCardNumber: {
    color: "#c796a1",
    fontSize: 22,
    fontWeight: "900",
  },
  focusCardAction: {
    color: "#29151c",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 26,
  },
  focusCardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#dfc5cc",
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  focusCardFooterText: {
    color: "#8c3d50",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  nextSteps: {
    marginTop: 28,
  },
  nextStepsLabel: {
    color: "#ff9aaa",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingVertical: 14,
    gap: 14,
  },
  nextStepNumber: {
    color: "#ff9aaa",
    fontSize: 12,
    lineHeight: 22,
    fontWeight: "800",
  },
  nextStepText: {
    flex: 1,
    color: "#f0e5e8",
    fontSize: 15,
    lineHeight: 22,
  },
  stepDisclaimer: {
    color: "#c3afb5",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 20,
  },
  durationSection: { marginTop: 28 },
  durationHint: { color: "#d8cccf", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  durationOptions: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  durationCell: { width: "20%", padding: 4 },
  durationChoice: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: "#713d4d",
    borderRadius: 14,
    backgroundColor: "#21161a",
    alignItems: "center",
    justifyContent: "center",
  },
  durationSelected: { backgroundColor: "#f6e8eb", borderColor: "#f6e8eb" },
  durationValue: { color: colors.white, fontSize: 20, fontWeight: "900" },
  durationUnit: { color: "#ffb6c4", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  durationValueSelected: { color: "#702f43" },
  sessionIntro: { color: "#d8cccf", fontSize: 16, lineHeight: 24, marginTop: 14 },
  activeFocusCard: {
    borderWidth: 1,
    borderColor: "#713d4d",
    borderRadius: 22,
    backgroundColor: "#21161a",
    padding: 22,
    marginTop: 26,
  },
  activeFocusLabel: { color: "#ff9aaa", fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  activeFocusText: { color: colors.white, fontSize: 21, lineHeight: 29, fontWeight: "800", marginTop: 12 },
  timerCard: {
    borderWidth: 1,
    borderColor: "#9b5063",
    borderRadius: 28,
    backgroundColor: "#321822",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 18,
    marginTop: 20,
  },
  timerCaption: { color: "#ffb6c4", fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  timer: {
    color: colors.white,
    fontSize: 68,
    fontWeight: "900",
    letterSpacing: -3,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  timerDuration: { color: "#d9aab6", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 4 },
  sessionAction: { marginTop: 20 },
  completionNote: { color: "#d8cccf", fontSize: 14, lineHeight: 21, marginTop: 20 },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 20 },
  suggestion: {
    color: colors.white40,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
});
