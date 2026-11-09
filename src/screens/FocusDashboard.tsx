import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
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
    void loadFocusDashboardMetrics()
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
    if (launchInProgress.current) return;
    launchInProgress.current = true;
    setLaunchError(null);
    try {
      await persistFocusFeatureLaunch(feature);
      action();
    } catch (error) {
      setLaunchError(firebaseErrorMessage(error));
    } finally {
      launchInProgress.current = false;
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
      <Animated.View pointerEvents="none" style={[styles.aura, auraStyle]}>
        <LinearGradient
          colors={["#b3133b", "#e11d48", "rgba(225,29,72,0)"]}
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
          <View style={styles.nav}>
            <Text style={styles.back}>Dashboard → </Text>
            <Text style={styles.hint}>(drag right to exit focus state)</Text>
          </View>
        </GestureDetector>
        <Text style={styles.title}>Focus state.</Text>
        <Text style={styles.intro}>Choose how you want to focus today.</Text>
        {launchError && <Text style={styles.error}>{launchError}</Text>}
        <View style={styles.gateways}>
          <Gateway
            title="Get shit done."
            label="music & focus timer"
            description="Open Apple Music or Spotify to choose your sound. Your focus timer starts when you return to Kenetic."
            onLaunch={() => void launchFeature("get-shit-done", onGetShitDone)}
          />
          <Gateway
            title="Alien mode."
            label="AI task breakdown"
            description="Turns an overwhelming task into small suggested steps with your consent."
            onLaunch={() => void launchFeature("alien-mode", onAlienMode)}
          />
        </View>
        <Text style={styles.statsHeading}>YOUR FOCUS ACTIVITY</Text>
        {!metricsLoaded && !metricsError && <Text style={styles.loading}>Loading your activity...</Text>}
        {metricsLoaded && <View style={styles.metrics}>
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
            label="music handoffs completed"
          />
        </View>}
        {metricsError && (
          <SwipeAction label="Focus statistics unavailable. Retry" onActivate={() => setReloadToken((value) => value + 1)} />
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
  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onStart(() => {
      active.value = true;
      runOnJS(triggerFocusImpact)();
    })
    .onUpdate((event) => {
      x.value = Math.max(-100, Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      active.value = false;
      if (event.translationX < -80) {
        runOnJS(onLaunch)();
      }
      x.value = withSpring(0, { damping: 16, stiffness: 180 });
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: active.value ? 1.02 : 1 }],
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
  content: { padding: 28, paddingTop: 104, paddingBottom: 72 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 32,
  },
  back: { color: "#ff9aaa", fontSize: 15, fontWeight: "700" },
  hint: { color: "#c5b6ba", fontSize: 12, fontWeight: "500", flexShrink: 1 },
  title: {
    color: "#fff",
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 10,
  },
  intro: { color: "#ded0d3", fontSize: 16, lineHeight: 24, marginBottom: 30 },
  statsHeading: { color: "#ff9aaa", fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginTop: 42, marginBottom: 18 },
  loading: { color: "#d0c4c6", fontSize: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", flexGrow: 1, backgroundColor: "#191417", borderRadius: 16, padding: 15, minHeight: 95 },
  metricValue: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -2,
  },
  metricLabel: {
    color: "#c8bdc0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  gateways: { gap: 14 },
  gateway: { borderWidth: 1, borderColor: "#6d3342", borderRadius: 24, backgroundColor: "#23151a", padding: 22 },
  gatewayTitle: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  gatewayLabel: {
    color: "#ff9aaa",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  gatewayDescription: {
    color: "#dfd2d5",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  gatewayHint: {
    color: "#ff9aaa",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
  error: { color: "#fca5a5", fontSize: 12, lineHeight: 18, marginBottom: 18 },
});
