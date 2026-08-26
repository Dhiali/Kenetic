import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  const [reloadToken, setReloadToken] = React.useState(0);
  const auraScale = useSharedValue(1);
  const auraMorph = useSharedValue(0);
  const exitX = useSharedValue(0);
  const metricsReveal = useSharedValue(0);

  useEffect(() => {
    metricsReveal.value = 0;
    void loadOutdoorDashboardMetrics()
      .then((result) => {
        setMetrics(result);
        setMetricsError(false);
        metricsReveal.value = withTiming(1, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
        });
      })
      .catch(() => setMetricsError(true));
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
      <Animated.View style={[styles.aura, auraStyle]}>
        <LinearGradient
          colors={["#14532d", "#16a34a", "rgba(22,163,74,0)"]}
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
            <Text style={styles.hint}>(drag right to exit outdoors state)</Text>
          </View>
        </GestureDetector>
        <Text style={styles.title}>Outdoors state.</Text>
        <Text style={styles.manifesto}>
          Connecting with yourself and the environment around you through the
          practice of ecotherapy and somatic movement.
        </Text>
        <Animated.View style={[styles.metrics, metricsRevealStyle]}>
          <Metric
            value={`${metrics.speciesScanned}`}
            label="species scanned in nature"
          />
          <Metric
            value={`${metrics.quizAttempts}`}
            label="curiosity quiz answers logged"
          />
          <Metric
            value={`${metrics.masteryIndex}%`}
            label="knowledge retention / mastery index"
          />
          <Metric
            value={`${metrics.activeLearningDays}`}
            label="active learning days this week"
          />
        </Animated.View>
        {metricsError && (
          <Pressable onPress={retryMetrics} hitSlop={12}>
            <Text style={styles.metricsError}>
              Ledger unavailable. Tap to retry.
            </Text>
          </Pressable>
        )}
        <View style={styles.gateways}>
          <Gateway
            title="Bio Radar AI."
            label="visual & acoustic species scanner"
            description="Point your camera or microphone at plants or animals to generate a designed breakdown card detailing what it is and its ecological significance."
            onLaunch={onBioRadar}
          />
          <Gateway
            title="Curiosity Quizzes."
            label="adaptive knowledge retention"
            description="Generated daily questions based directly on your Bio Radar scan history, turning your real-world discoveries into long-term environmental knowledge."
            onLaunch={onCuriosity}
          />
          <Gateway
            title="Spot Finder."
            label="trails, waters & sanctuaries"
            description="Discover nearby hiking trails, fishing spots and natural parks. Activate location-bound challenges when arriving at a spot to earn physical restoration badges and rewards."
            onLaunch={onSpotFinder}
          />
          <Gateway
            title="Daily Challenges."
            label="everyday outdoor grounding"
            description={
              'Simple, perceptive tasks for an ordinary day outside (e.g., "Find a natural pattern that mimics a fish" or "Locate three distinct bark textures").'
            }
            onLaunch={onChallenges}
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
  onLaunch,
}: {
  title: string;
  label: string;
  description: string;
  onLaunch: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const active = useSharedValue(false);

  const triggerLightHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      active.value = true;
      runOnJS(triggerLightHaptic)();
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
        <Text style={styles.gatewayLabel}>{label}</Text>
        <Text style={styles.gatewayDescription}>{description}</Text>
        <Text style={styles.gatewayHint}>← swipe to open</Text>
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
  content: { padding: 28, paddingTop: 48, paddingBottom: 48 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 60,
    marginBottom: 24,
  },
  back: { color: "#16a34a", fontSize: 15, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: "500" },
  title: {
    color: "#fff",
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 36,
  },
  manifesto: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 15,
    lineHeight: 23,
    marginTop: -20,
    marginBottom: 32,
  },
  metrics: { gap: 18, marginBottom: 64 },
  metricsError: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: -48,
    marginBottom: 48,
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
    color: "#16a34a",
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
    color: "#16a34a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
});
