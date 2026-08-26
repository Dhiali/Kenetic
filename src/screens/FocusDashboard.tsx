import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
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
    loadFocusDashboardMetrics,
    persistFocusFeatureLaunch,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";

const triggerFocusImpact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

type Props = {
  onBack: () => void;
  onGetShitDone?: () => void;
  onAlienMode?: () => void;
};

export default function FocusDashboard({
  onBack,
  onGetShitDone = () => undefined,
  onAlienMode = () => undefined,
}: Props) {
  const [metrics, setMetrics] = React.useState({
    completedSessions: 0,
    getShitDoneSessions: 0,
    alienModeSessions: 0,
    handoffCompletedSessions: 0,
    getShitDoneMinutes: 0,
    alienModeMinutes: 0,
    totalFocusMinutes: 0,
  });
  const [launchError, setLaunchError] = React.useState<string | null>(null);
  const auraScale = useSharedValue(1);
  const auraMorph = useSharedValue(0);
  const exitX = useSharedValue(0);

  useEffect(() => {
    void loadFocusDashboardMetrics()
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
      if (event.translationX > 80) {
        runOnJS(onBack)();
      } else {
        exitX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const launchFeature = async (
    feature: "get-shit-done" | "alien-mode",
    action: () => void,
  ) => {
    setLaunchError(null);
    try {
      await persistFocusFeatureLaunch(feature);
      action();
    } catch (error) {
      setLaunchError(firebaseErrorMessage(error));
    }
  };

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

  return (
    <Animated.View
      style={[styles.screen, screenStyle]}
      entering={FadeIn.duration(500)}
    >
      <Animated.View style={[styles.aura, auraStyle]}>
        <LinearGradient
          colors={["#b3133b", "#e11d48", "rgba(225,29,72,0)"]}
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
            <Text style={styles.back}>← dashboard </Text>
            <Text style={styles.hint}>(drag right to exit focus state)</Text>
          </View>
        </GestureDetector>
        <Text style={styles.title}>focus state.</Text>
        <View style={styles.metrics}>
          <Metric
            value={`${metrics.completedSessions}`}
            label="completed sessions"
          />
          <Metric
            value={`${metrics.totalFocusMinutes}m`}
            label="focus time completed"
          />
          <Metric
            value={`${metrics.getShitDoneSessions}`}
            label="get shit done sessions"
          />
          <Metric
            value={`${metrics.alienModeSessions}`}
            label="alien mode sessions"
          />
          <Metric
            value={`${metrics.alienModeMinutes}m`}
            label="alien mode time completed"
          />
          <Metric
            value={`${metrics.handoffCompletedSessions}`}
            label="two-minute handoffs completed"
          />
        </View>
        {launchError && <Text style={styles.error}>{launchError}</Text>}
        <View style={styles.gateways}>
          <Gateway
            title="get shit done."
            label="sound tether & app lock"
            description="Connects Apple Music or Spotify. Activates background audio and automatically pauses playback if you stay actively on your phone for more than 2 minutes."
            onLaunch={() => void launchFeature("get-shit-done", onGetShitDone)}
          />
          <Gateway
            title="alien mode."
            label="ai task deconstructor"
            description={
              'Intercepts overwhelming tasks and prompts you with a "Beginner\'s Mind" question to reframe your perspective before the timer begins.'
            }
            onLaunch={() => void launchFeature("alien-mode", onAlienMode)}
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
  const y = useSharedValue(0);
  const active = useSharedValue(false);
  const gesture = Gesture.Pan()
    .onStart(() => {
      active.value = true;
      runOnJS(triggerFocusImpact)();
    })
    .onUpdate((event) => {
      y.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      active.value = false;
      if (event.translationX < -80) {
        runOnJS(onLaunch)();
      }
      y.value = withSpring(0, { damping: 16, stiffness: 180 });
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: active.value ? 1.03 : 1 }],
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
    left: -90,
    width: 430,
    height: 420,
    borderRadius: 220,
    overflow: "hidden",
    shadowColor: "#e11d48",
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
  back: { color: "#e11d48", fontSize: 15, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: "500" },
  title: {
    color: "#fff",
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 36,
  },
  metrics: { gap: 18, marginBottom: 64 },
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
    color: "#e11d48",
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
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
  error: { color: "#fca5a5", fontSize: 12, lineHeight: 18, marginBottom: 18 },
});
