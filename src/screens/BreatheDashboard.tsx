import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    Easing,
    FadeIn,
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
    loadBreatheDashboardMetrics,
    persistBreatheExerciseLaunch,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";

type Props = {
  onBack: () => void;
  onCalm?: () => void;
  onRecenter?: () => void;
  onClearMind?: () => void;
  onDeepRelax?: () => void;
};

export default function BreatheDashboard({
  onBack,
  onCalm = () => undefined,
  onRecenter = () => undefined,
  onClearMind = () => undefined,
  onDeepRelax = () => undefined,
}: Props) {
  const [metrics, setMetrics] = React.useState({
    completedSessions: 0,
    restorationMinutes: 0,
    recoveryIndex: 0,
  });
  const [launchError, setLaunchError] = React.useState<string | null>(null);
  const [launching, setLaunching] = React.useState(false);
  const auraScale = useSharedValue(1);
  const auraMorph = useSharedValue(0);
  const exitX = useSharedValue(0);
  useEffect(() => {
    void loadBreatheDashboardMetrics()
      .then(setMetrics)
      .catch(() => undefined);
    auraScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    auraMorph.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);
  const exitGesture = Gesture.Pan()
    .activeOffsetX(10)
    .onUpdate((event) => {
      if (event.translationX > 0) exitX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > 80) runOnJS(onBack)();
      else exitX.value = withSpring(0, { damping: 15, stiffness: 200 });
    });
  const auraStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: auraScale.value },
      { translateX: interpolate(auraMorph.value, [-1, 1], [-30, 20]) },
      { translateY: interpolate(auraMorph.value, [-1, 1], [-20, 25]) },
      { scaleX: interpolate(auraMorph.value, [-1, 1], [0.94, 1.15]) },
      { scaleY: interpolate(auraMorph.value, [-1, 1], [1.12, 0.9]) },
    ],
  }));
  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: exitX.value }],
  }));

  const launchExercise = async (
    exercise: "calm-down" | "recenter" | "clear-mind" | "deep-relax",
    action: () => void,
  ) => {
    if (launching) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      await persistBreatheExerciseLaunch(exercise);
      action();
    } catch (error) {
      setLaunchError(firebaseErrorMessage(error));
    } finally {
      setLaunching(false);
    }
  };
  return (
    <Animated.View
      style={[styles.screen, screenStyle]}
      entering={FadeIn.duration(500)}
    >
      <Animated.View style={[styles.aura, auraStyle]}>
        <LinearGradient
          colors={["#9a3412", "#f97316", "rgba(249,115,22,0)"]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <BlurView
          intensity={70}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <GestureDetector gesture={exitGesture}>
          <View style={styles.nav}>
            <Text style={styles.back}>← Dashboard </Text>
            <Text style={styles.hint}>(drag right to exit breathe state)</Text>
          </View>
        </GestureDetector>
        <Text style={styles.title}>Breathe state.</Text>
        <Text style={styles.manifesto}>
          Use breath to settle your body, clear your attention, and return to
          the present moment.
        </Text>
        <View style={styles.metrics}>
          <Metric
            value={`${metrics.completedSessions}`}
            label="sessions completed this week"
          />
          <Metric
            value={`${metrics.restorationMinutes}m`}
            label="somatic restoration this week"
          />
          <Metric
            value={`${metrics.recoveryIndex}%`}
            label="calm index / nervous system recovery"
          />
        </View>
        {launchError && <Text style={styles.launchError}>{launchError}</Text>}
        <View style={styles.gateways}>
          <Gateway
            accent="#f97316"
            title="Calm down."
            label="physiological sigh (two quick inhales, long slow exhale)"
            description="Acute anxiety, racing heart rate, physical tension."
            onLaunch={() => void launchExercise("calm-down", onCalm)}
          />
          <Gateway
            accent="#e11d48"
            title="Recenter."
            label="4-7-8 rhythmic grounding"
            description="Midday distraction, emotional turbulence, task switching."
            onLaunch={() => void launchExercise("recenter", onRecenter)}
          />
          <Gateway
            accent="#16a34a"
            title="Clear mind."
            label="4-4-4-4 box breathing"
            description="Brain fog, mental overload, pre-focus preparation."
            onLaunch={() => void launchExercise("clear-mind", onClearMind)}
          />
          <Gateway
            accent="#d6c3a5"
            title="Deep relax."
            label="non-sleep deep rest (NSDR) / somatic body scan"
            description="Sleep preparation, post-work shutdown, severe fatigue."
            onLaunch={() => void launchExercise("deep-relax", onDeepRelax)}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function Gateway({
  title,
  label,
  description,
  accent,
  onLaunch,
}: {
  title: string;
  label: string;
  description: string;
  accent: string;
  onLaunch: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const active = useSharedValue(false);
  const gesture = Gesture.Pan()
    .onStart(() => {
      active.value = true;
    })
    .onUpdate((event) => {
      x.value = Math.min(0, event.translationX);
      y.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      active.value = false;
      if (event.translationX < -80) runOnJS(onLaunch)();
      x.value = withSpring(0, { damping: 16, stiffness: 180 });
      y.value = withSpring(0, { damping: 16, stiffness: 180 });
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: active.value ? 1.03 : 1 },
    ],
    opacity: active.value ? 0.88 : 1,
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.gateway, style]}>
        <Text style={styles.gatewayTitle}>{title}</Text>
        <Text style={[styles.gatewayLabel, { color: accent }]}>{label}</Text>
        <Text style={styles.gatewayDescription}>{description}</Text>
        <Text style={[styles.gatewayHint, { color: accent }]}>
          ← swipe to open
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a", overflow: "hidden" },
  aura: {
    position: "absolute",
    top: -150,
    right: -80,
    width: 430,
    height: 420,
    borderRadius: 220,
    overflow: "hidden",
    shadowColor: "#f97316",
    shadowOpacity: 0.55,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  content: { padding: 28, paddingTop: 48, paddingBottom: 48 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 60,
    marginBottom: 24,
  },
  back: { color: "#f97316", fontSize: 15, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: "500" },
  title: {
    color: "#fff",
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 16,
  },
  manifesto: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 32,
  },
  metrics: { gap: 18, marginBottom: 64 },
  launchError: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  metric: { flexDirection: "row", alignItems: "baseline", gap: 14 },
  metricValue: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    minWidth: 110,
  },
  metricLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  gateways: { gap: 40 },
  gateway: { borderTopWidth: 1, borderTopColor: "#242424", paddingTop: 24 },
  gatewayTitle: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  gatewayLabel: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  gatewayDescription: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  gatewayHint: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
});
