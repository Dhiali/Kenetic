import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
import { loadOutdoorDashboardMetrics } from "../lib/firebase/bootstrap";

type Props = {
  onBack: () => void;
  onBioRadar?: () => void;
  onCuriosity?: () => void;
  onSpotFinder?: () => void;
  onChallenges?: () => void;
};

export default function OutdoorsDashboard({
  onBack,
  onBioRadar = () => undefined,
  onCuriosity = () => undefined,
  onSpotFinder = () => undefined,
  onChallenges = () => undefined,
}: Props) {
  const [metrics, setMetrics] = React.useState({
    speciesScanned: 0,
    quizAttempts: 0,
    masteryIndex: 0,
    activeLearningDays: 0,
  });
  const [metricsError, setMetricsError] = React.useState(false);
  const [metricsLoaded, setMetricsLoaded] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);
  const auraScale = useSharedValue(1);
  const auraMorph = useSharedValue(0);
  const exitX = useSharedValue(0);
  const metricsReveal = useSharedValue(0);

  useEffect(() => {
    let active = true;
    metricsReveal.value = 0;
    setMetricsLoaded(false);
    setMetricsError(false);
    void loadOutdoorDashboardMetrics()
      .then((result) => {
        if (!active) return;
        setMetrics(result);
        setMetricsLoaded(true);
        metricsReveal.value = withTiming(1, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
        });
      })
      .catch(() => { if (active) setMetricsError(true); });
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
  const metricsRevealStyle = useAnimatedStyle(() => ({
    opacity: metricsReveal.value,
    transform: [
      { translateY: interpolate(metricsReveal.value, [0, 1], [14, 0]) },
    ],
  }));

  const retryMetrics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    setReloadToken((value) => value + 1);
  };

  return (
    <Animated.View
      style={[styles.screen, screenStyle]}
      entering={FadeIn.duration(500)}
    >
      <Animated.View pointerEvents="none" style={[styles.aura, auraStyle]}>
        <LinearGradient
          colors={["#14532d", "#16a34a", "rgba(22,163,74,0)"]}
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <GestureDetector gesture={exitGesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Return to dashboard"
            accessibilityHint="Drag right, or activate to leave Outdoors."
            accessibilityActions={[{ name: "activate", label: "Return to dashboard" }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "activate") onBack();
            }}
            onAccessibilityTap={onBack}
            style={styles.nav}
          >
            <Text style={styles.back}>Dashboard → </Text>
            <Text style={styles.hint}>(Drag right to exit outdoors state)</Text>
          </View>
        </GestureDetector>
        <Text style={styles.title}>Outdoors state.</Text>
        <Text style={styles.manifesto}>Find a little space to explore, learn, and reconnect with nature.</Text>
        <View style={styles.gateways}>
          <Gateway
            title="Bio Radar."
            label="Photo nature discovery"
            description="Use a photo to explore AI-suggested nature discoveries. Results are uncertain and not safety advice."
            onLaunch={onBioRadar}
          />
          <Gateway
            title="Curiosity Quizzes."
            label="Discovery & nature recall"
            description="Revisit your Bio Radar discoveries and explore daily nature questions."
            onLaunch={onCuriosity}
          />
          <Gateway
            title="Spot Keeper."
            label="Trails, waters & sanctuaries"
            description="Save and revisit places you find calming."
            onLaunch={onSpotFinder}
          />
          <Gateway
            title="Daily Challenges."
            label="Everyday outdoor grounding"
            description={
              'Simple, perceptive tasks for an ordinary day outside (e.g., "Find a natural pattern that mimics a fish" or "Locate three distinct bark textures").'
            }
            onLaunch={onChallenges}
          />
        </View>
        <Text style={styles.statsHeading}>YOUR OUTDOOR ACTIVITY</Text>
        {!metricsLoaded && !metricsError && <Text style={styles.loading}>Loading your activity...</Text>}
        {metricsLoaded && (
          <Animated.View style={[styles.metrics, metricsRevealStyle]}>
            <Metric value={`${metrics.speciesScanned}`} label="Discoveries saved" />
            <Metric value={`${metrics.quizAttempts}`} label="Quiz answers logged" />
            <Metric value={`${metrics.masteryIndex}%`} label="Knowledge mastery" />
            <Metric value={`${metrics.activeLearningDays}`} label="Learning days this week" />
          </Animated.View>
        )}
        {metricsError && (
          <SwipeAction label="Outdoor statistics unavailable. Retry" onActivate={retryMetrics} />
        )}
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
  onLaunch,
}: {
  title: string;
  label: string;
  description: string;
  onLaunch: () => void;
}) {
  const x = useSharedValue(0);
  const active = useSharedValue(false);

  const triggerLightHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  };

  const gesture = Gesture.Pan()
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
        accessibilityActions={[{ name: "activate", label: `Open ${title}` }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "activate") onLaunch();
        }}
        onAccessibilityTap={onLaunch}
        style={[styles.gateway, style]}
      >
        <Text style={styles.gatewayTitle}>{title}</Text>
        <Text style={styles.gatewayLabel}>{label}</Text>
        <Text style={styles.gatewayDescription}>{description}</Text>
        <Text style={styles.gatewayHint}>        ← Swipe to open</Text>
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
    shadowColor: "#16a34a",
    shadowOpacity: 0.55,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  content: { padding: 28, paddingTop: 104, paddingBottom: 72 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 32,
  },
  back: { color: "#a5e9bb", fontSize: 15, fontWeight: "700" },
  hint: { color: "#b9cbbf", fontSize: 12, fontWeight: "500", flexShrink: 1 },
  title: {
    color: "#fff",
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 10,
  },
  manifesto: {
    color: "#cfdfd4",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },
  statsHeading: { color: "#a5e9bb", fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginTop: 42, marginBottom: 18 },
  loading: { color: "#c5d5c9", fontSize: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", flexGrow: 1, backgroundColor: "#142018", borderRadius: 16, padding: 15, minHeight: 95 },
  metricValue: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -2,
  },
  metricLabel: {
    color: "#bfd0c3",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  gateways: { gap: 14 },
  gateway: { borderWidth: 1, borderColor: "#346348", borderRadius: 24, backgroundColor: "#14241a", padding: 22 },
  gatewayTitle: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  gatewayLabel: {
    color: "#a5e9bb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  gatewayDescription: {
    color: "#d0dfd4",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  gatewayHint: {
    color: "#a5e9bb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
});
