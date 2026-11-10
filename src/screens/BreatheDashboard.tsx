import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SwipeAction from "../components/SwipeAction";
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
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = React.useState({
    completedSessions: 0,
    restorationMinutes: 0,
    recoveryIndex: 0,
  });
  const [launchError, setLaunchError] = React.useState<string | null>(null);
  const [launching, setLaunching] = React.useState(false);
  const [metricsError, setMetricsError] = React.useState(false);
  const [metricsLoaded, setMetricsLoaded] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);
  const launchInProgress = useRef(false);
  const auraScale = useSharedValue(1);
  const auraMorph = useSharedValue(0);
  const exitX = useSharedValue(0);
  useEffect(() => {
    let active = true;
    setMetricsLoaded(false);
    setMetricsError(false);
    void loadBreatheDashboardMetrics()
      .then((result) => {
        if (!active) return;
        setMetrics(result);
        setMetricsLoaded(true);
      })
      .catch(() => {
        if (active) setMetricsError(true);
      });
    return () => { active = false; };
  }, [reloadToken]);

  useEffect(() => {
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
    if (launchInProgress.current || launching) return;
    launchInProgress.current = true;
    setLaunching(true);
    setLaunchError(null);
    try {
      await persistBreatheExerciseLaunch(exercise);
      action();
    } catch (error) {
      setLaunchError(firebaseErrorMessage(error));
    } finally {
      launchInProgress.current = false;
      setLaunching(false);
    }
  };
  return (
    <Animated.View
      style={[styles.screen, screenStyle]}
      entering={FadeIn.duration(500)}
    >
      <Animated.View pointerEvents="none" style={[styles.aura, auraStyle]}>
        <LinearGradient
          colors={["#9a3412", "#f97316", "rgba(249,115,22,0)"]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView
          intensity={70}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <GestureDetector gesture={exitGesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Return to dashboard"
            accessibilityHint="Drag right, or activate to leave Breathe."
            accessibilityActions={[{ name: "activate", label: "Return to dashboard" }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "activate") onBack();
            }}
            onAccessibilityTap={onBack}
            style={styles.nav}
          >
            <Text style={styles.back}>Dashboard → </Text>
            <Text style={styles.hint}>(Drag right to exit breathe state)</Text>
          </View>
        </GestureDetector>
        <Text style={styles.title}>Breathe state.</Text>
        <Text style={styles.manifesto}>
          Take a moment to slow down and find a rhythm that feels right for you.
        </Text>
        {launchError && <Text accessibilityLiveRegion="polite" style={styles.launchError}>{launchError}</Text>}
        {launching && <Text accessibilityLiveRegion="polite" style={styles.loading}>Opening your exercise...</Text>}
        <View style={styles.gateways}>
          <Gateway
            title="Calm down."
            label="3 minutes / Physiological sigh"
            description="Two quick inhales followed by a longer, slow exhale."
            disabled={launching}
            onLaunch={() => void launchExercise("calm-down", onCalm)}
          />
          <Gateway
            title="Recenter."
            label="5 minutes / 4-7-8 breathing"
            description="Follow a steady rhythm of inhaling, holding and exhaling."
            disabled={launching}
            onLaunch={() => void launchExercise("recenter", onRecenter)}
          />
          <Gateway
            title="Clear mind."
            label="4 minutes / Box breathing"
            description="Breathe in, hold, breathe out and pause for equal counts."
            disabled={launching}
            onLaunch={() => void launchExercise("clear-mind", onClearMind)}
          />
          <Gateway
            title="Deep relax."
            label="10 minutes / Body scan"
            description="Take a longer moment to slow down and relax your body."
            disabled={launching}
            onLaunch={() => void launchExercise("deep-relax", onDeepRelax)}
          />
        </View>
        <Text style={styles.statsHeading}>YOUR BREATHE ACTIVITY</Text>
        {!metricsLoaded && !metricsError && <Text style={styles.loading}>Loading your activity...</Text>}
        {metricsLoaded && (
          <View style={styles.activity}>
            <View style={styles.weekCard}>
              <Text style={styles.activityLabel}>THIS WEEK</Text>
              <Text style={styles.weekTime}>{metrics.restorationMinutes}m</Text>
              <Text style={styles.weekCaption}>In completed breathing sessions</Text>
              <Text style={styles.weekDetail}>{metrics.completedSessions} {metrics.completedSessions === 1 ? "session completed" : "sessions completed"}</Text>
            </View>
            <View style={styles.rateCard}>
              <Text style={styles.activityLabel}>SESSION COMPLETION</Text>
              <Text style={styles.rateValue}>{metrics.recoveryIndex}%</Text>
              <Text style={styles.rateCaption}>Of sessions started this week were completed.</Text>
            </View>
            <Text style={styles.activityNote}>This week starts on Monday. Completion is not a measure of recovery.</Text>
          </View>
        )}
        {metricsError && (
          <SwipeAction label="Breathe statistics unavailable. Retry" onActivate={() => setReloadToken((value) => value + 1)} />
        )}
      </ScrollView>
    </Animated.View>
  );
}
function Gateway({
  title,
  label,
  description,
  disabled,
  onLaunch,
}: {
  title: string;
  label: string;
  description: string;
  disabled: boolean;
  onLaunch: () => void;
}) {
  const x = useSharedValue(0);
  const active = useSharedValue(false);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onStart(() => {
      active.value = true;
      runOnJS(triggerLightHaptic)();
    })
    .onUpdate((event) => {
      x.value = Math.max(-100, Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX < -80) runOnJS(onLaunch)();
    })
    .onFinalize(() => {
      active.value = false;
      x.value = withSpring(0, { damping: 16, stiffness: 180 });
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { scale: active.value ? 1.02 : 1 },
    ],
    opacity: active.value ? 0.88 : 1,
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint="Swipe left or activate to open."
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate", label: `Open ${title}` }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === "activate") onLaunch();
        }}
        onAccessibilityTap={() => { if (!disabled) onLaunch(); }}
        style={[styles.gateway, style, disabled && styles.disabled]}
      >
        <Text style={styles.gatewayTitle}>{title}</Text>
        <Text style={styles.gatewayLabel}>{label}</Text>
        <Text style={styles.gatewayDescription}>{description}</Text>
        <Text style={styles.gatewayHint}>← Swipe to open</Text>
      </Animated.View>
    </GestureDetector>
  );
}
function triggerLightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
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
  content: { paddingHorizontal: 28 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 32,
  },
  back: { color: "#ffc18f", fontSize: 15, fontWeight: "700" },
  hint: { color: "#dbc5b7", fontSize: 12, fontWeight: "500", flexShrink: 1 },
  title: {
    color: "#fff",
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 10,
  },
  manifesto: {
    color: "#e5d3c7",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },
  launchError: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  statsHeading: { color: "#ffc18f", fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginTop: 42, marginBottom: 18 },
  loading: { color: "#e0cabe", fontSize: 14, marginBottom: 12 },
  activity: { gap: 10 },
  weekCard: { backgroundColor: "#3d241b", borderWidth: 1, borderColor: "#89573e", borderRadius: 20, padding: 20 },
  activityLabel: { color: "#ffc18f", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  weekTime: { color: "#fff", fontSize: 42, fontWeight: "900", letterSpacing: -1.5, marginTop: 10 },
  weekCaption: { color: "#f2ddd0", fontSize: 13, marginTop: 2 },
  weekDetail: { color: "#fff0e7", fontSize: 13, fontWeight: "700", borderTopWidth: 1, borderTopColor: "#895e4b", marginTop: 18, paddingTop: 14 },
  rateCard: { backgroundColor: "#201813", borderRadius: 16, padding: 18 },
  rateValue: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 },
  rateCaption: { color: "#e1cfc3", fontSize: 13, lineHeight: 19, marginTop: 4 },
  activityNote: { color: "#d1bcb0", fontSize: 12, lineHeight: 18, marginTop: 4 },
  gateways: { gap: 14 },
  gateway: { borderWidth: 1, borderColor: "#80503b", borderRadius: 24, backgroundColor: "#291a15", padding: 22 },
  disabled: { opacity: 0.6 },
  gatewayTitle: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  gatewayLabel: {
    color: "#ffc18f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  gatewayDescription: {
    color: "#ead9cf",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  gatewayHint: {
    color: "#ffc18f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
});
