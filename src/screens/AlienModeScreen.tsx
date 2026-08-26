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
import { firebaseErrorMessage } from "../lib/firebase/errors";
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

const localReframe = (task: string) => {
  const normalizedTask = task.trim();
  const lowerTask = normalizedTask.toLowerCase();
  const isAllergyConcern =
    lowerTask.includes("allerg") ||
    lowerTask.includes("peanut") ||
    lowerTask.includes("nut") ||
    lowerTask.includes("anaphyl");
  const isProcrastinationConcern =
    lowerTask.includes("procrast") ||
    lowerTask.includes("putting it off") ||
    lowerTask.includes("can't start") ||
    lowerTask.includes("cannot start");

  if (isAllergyConcern) {
    return {
      prompt:
        "What is the safest immediate action before you eat or handle this food?",
      microAction:
        "Put the food aside, check its label, and ask a trusted healthcare professional if allergic.",
    };
  }

  if (isProcrastinationConcern) {
    return {
      prompt:
        "What is the smallest visible action that takes less than five minutes?",
      microAction:
        "Open the task and write down the single first step you can do now.",
    };
  }

  const prompt = lowerTask.includes("email")
    ? "What is the first person or message you need to place in front of you?"
    : lowerTask.includes("report") || lowerTask.includes("document")
      ? "If you had to teach this to an alien, what is the first physical object you need to touch?"
      : lowerTask.includes("meeting") || lowerTask.includes("call")
        ? "What is the smallest visible preparation that makes this meeting real?"
        : "What is the absolute smallest edge piece of this puzzle?";
  return {
    prompt,
    microAction: normalizedTask,
  };
};

type Phase = "confession" | "interception" | "ritual" | "active" | "complete";

export default function AlienModeScreen({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("confession");
  const [task, setTask] = useState("");
  const [microAction, setMicroAction] = useState("");
  const [isolatedFocus, setIsolatedFocus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(ACTIVE_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const finalizingRef = useRef(false);
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
    void restoreActiveSession();
    return () => undefined;
  }, []);

  useEffect(() => {
    if (phase !== "active") return;
    const tick = () => {
      void AsyncStorage.getItem(ACTIVE_DEADLINE_KEY).then((value) => {
        if (!value) return;
        const next = Math.max(
          0,
          Math.ceil((Number(value) - Date.now()) / 1000),
        );
        setRemaining(next);
        if (next === 0) void completeActiveSession();
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, sessionId]);

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === "active" && phase === "active") void restoreActiveSession();
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

  const surrender = () => {
    if (!task.trim()) {
      setError("Name the task you are ready to make smaller.");
      return;
    }
    setError(null);
    const result = localReframe(task);
    setPrompt(result.prompt);
    setMicroAction(result.microAction);
    setPhase("interception");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
      () => undefined,
    );
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
    setError(null);
    try {
      const nextSessionId = await startAlienModeSession(
        task.trim(),
        isolatedFocus.trim(),
        prompt.trim(),
      );
      const deadline = Date.now() + ACTIVE_SECONDS * 1000;
      await AsyncStorage.multiSet([
        [ACTIVE_SESSION_KEY, nextSessionId],
        [ACTIVE_DEADLINE_KEY, String(deadline)],
        [TASK_KEY, task.trim()],
        [MICRO_ACTION_KEY, isolatedFocus.trim()],
        [PROMPT_KEY, prompt.trim()],
      ]);
      setSessionId(nextSessionId);
      setRemaining(ACTIVE_SECONDS);
      setPhase("active");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
        () => undefined,
      );
    } catch (beginError) {
      setError(firebaseErrorMessage(beginError));
    }
  };

  const completeActiveSession = async () => {
    if (!sessionId || finalizingRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    try {
      await finishAlienModeSession(sessionId, ACTIVE_SECONDS, true);
      await clearAlienSessionStorage();
      setPhase("complete");
      setSessionId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (completionError) {
      setError(firebaseErrorMessage(completionError));
      setRemaining(1);
      finalizingRef.current = false;
      setFinalizing(false);
    }
  };

  const leave = async () => {
    if (finalizingRef.current) return;
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
      await clearAlienSessionStorage();
      onBack();
    } catch (leaveError) {
      setError(firebaseErrorMessage(leaveError));
      finalizingRef.current = false;
      setFinalizing(false);
    }
  };

  const restoreActiveSession = async () => {
    const [
      savedSession,
      savedDeadline,
      savedTask,
      savedMicroAction,
      savedPrompt,
    ] = await AsyncStorage.multiGet([
      ACTIVE_SESSION_KEY,
      ACTIVE_DEADLINE_KEY,
      TASK_KEY,
      MICRO_ACTION_KEY,
      PROMPT_KEY,
    ]).then((entries) => entries.map(([, value]) => value));
    if (!savedSession || !savedDeadline) return;
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
    if (next === 0) void completeActiveSession();
  };

  const renderConfession = () => (
    <>
      <Text style={styles.title}>what is looming?</Text>
      <TextInput
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
      <SwipeAction
        label="flick to surrender →"
        direction="right"
        onComplete={surrender}
        color={colors.rose}
      />
    </>
  );

  const renderInterception = () => (
    <>
      <View style={styles.whiteCircle}>
        <Text style={styles.prompt}>{prompt}</Text>
        <Text style={styles.circleAction}>{microAction}</Text>
      </View>
      <Text style={styles.circleExplanation}>
        See this situation from this perspective for the next 30 minutes and
        notice what changes.
      </Text>
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
      <Text style={styles.ritualPrompt}>{prompt}</Text>
      <BeginPuzzle onComplete={() => void begin()} />
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
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <GestureDetector
            gesture={Gesture.Pan().onEnd((event) => {
              if (event.translationX > 80) runOnJS(onBack)();
            })}
          >
            <Text style={[styles.nav, phase === "ritual" && styles.ritualText]}>
              ← focus state.
            </Text>
          </GestureDetector>
          {phase === "confession" && renderConfession()}
          {phase === "interception" && renderInterception()}
          {phase === "ritual" && renderRitual()}
          {phase === "active" && (
            <>
              <Text style={styles.eyebrow}>focus active</Text>
              <Text style={styles.title}>one thing.</Text>
              <Text style={styles.subtitle}>{prompt}</Text>
              <Text style={styles.timer}>{formatTime(remaining)}</Text>
              <Text style={styles.leave} onPress={() => void leave()}>
                leave session →
              </Text>
            </>
          )}
          {phase === "complete" && (
            <>
              <Text style={styles.eyebrow}>focus complete</Text>
              <Text style={styles.title}>you stayed.</Text>
              <Text style={styles.subtitle}>
                The session was completed and logged.
              </Text>
              <Text style={styles.leave} onPress={onBack}>
                return to focus state →
              </Text>
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

function clearAlienSessionStorage() {
  return AsyncStorage.multiRemove([
    ACTIVE_SESSION_KEY,
    ACTIVE_DEADLINE_KEY,
    TASK_KEY,
    MICRO_ACTION_KEY,
    PROMPT_KEY,
  ]);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark, overflow: "hidden" },
  ritualScreen: { backgroundColor: colors.bgDark },
  keyboard: { flex: 1 },
  content: { padding: 28, paddingTop: 54, paddingBottom: 42 },
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
    color: colors.orange,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  title: {
    color: colors.white,
    fontSize: 50,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  subtitle: {
    color: colors.white50,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 18,
    maxWidth: 330,
  },
  input: {
    color: colors.white,
    fontSize: 20,
    lineHeight: 28,
    borderBottomWidth: 1,
    borderBottomColor: colors.white20,
    paddingVertical: 12,
    marginTop: 42,
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
    alignSelf: "center",
    width: 230,
    height: 230,
    borderRadius: 115,
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
    color: colors.white50,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 18,
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
    marginTop: 180,
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
