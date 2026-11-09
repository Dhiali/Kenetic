import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { persistInitialIntention } from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

function DraggableGoal({
  label,
  onDrop,
  disabled,
}: {
  label: string;
  onDrop: (label: string) => void;
  disabled: boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      isDragging.value = true;
      scale.value = withSpring(0.95);
      runOnJS(hapticLight)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      isDragging.value = false;
      scale.value = withSpring(1);

      if (e.translationY < -140) {
        runOnJS(hapticLight)();
        runOnJS(onDrop)(label);
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 14, stiffness: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: isDragging.value ? 100 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Choose ${label} as your intention`}
        accessibilityHint="Activate to select this intention."
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate", label: `Choose ${label}` }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === "activate") onDrop(label);
        }}
        onAccessibilityTap={() => { if (!disabled) onDrop(label); }}
        style={[styles.goalPill, animatedStyle]}
      >
        <Text style={styles.goalArrow}>↑</Text>
        <Text style={styles.goalText}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export default function IntakeScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [droppedGoal, setDroppedGoal] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInProgress = useRef(false);
  const { height } = useWindowDimensions();
  const compact = height < 700;

  const circleScale = useSharedValue(1);
  const circleOpacity = useSharedValue(0.15);

  useEffect(() => {
    circleScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 2000 }),
        withTiming(1, { duration: 2000 }),
      ),
      -1,
      true,
    );
    circleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 2000 }),
        withTiming(0.15, { duration: 2000 }),
      ),
      -1,
      true,
    );
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));

  const handleDrop = async (label: string) => {
    if (saveInProgress.current) return;
    saveInProgress.current = true;

    setDroppedGoal(label);
    setSaveError(null);
    circleScale.value = withTiming(3, { duration: 500 });
    circleOpacity.value = withTiming(0, { duration: 500 });

    try {
      await persistInitialIntention(label);
      setTimeout(onComplete, 600);
    } catch (error) {
      saveInProgress.current = false;
      setDroppedGoal(null);
      setSaveError(firebaseErrorMessage(error));
      circleScale.value = withTiming(1, { duration: 300 });
      circleOpacity.value = withTiming(0.15, { duration: 300 });
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <View pointerEvents="none" style={styles.ambientGlow}>
        <LinearGradient
          colors={[
            "rgba(22,163,74,0.54)",
            "rgba(249,115,22,0.38)",
            "rgba(225,29,72,0.3)",
            "rgba(10,10,10,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ambientGradient}
        />
        <BlurView intensity={30} tint="dark" style={styles.ambientBlur} />
      </View>

      <View style={[styles.header, compact && styles.headerCompact]}>
        <Text style={styles.eyebrow}>your first intention</Text>
        <Text style={styles.title}>
          {droppedGoal
            ? `${droppedGoal.toLowerCase()}.`
            : "What demands\nyour focus?"}
        </Text>
        <Text style={styles.subtitle}>
          Drag one intention up toward the circle.
        </Text>
      </View>

      <View style={[styles.targetZone, compact && styles.targetZoneCompact]}>
        <Animated.View style={[styles.glowHalo, circleStyle]} />
        <View style={styles.targetRing}>
          <View style={styles.targetCore}>
            <Text style={styles.targetEyebrow}>YOUR INTENTION</Text>
            <Text style={styles.targetLabel}>
              {droppedGoal ? droppedGoal.toLowerCase() : "drop here"}
            </Text>
          </View>
        </View>
      </View>

      {saveError && <Text style={styles.error}>{saveError}</Text>}

      {!droppedGoal && (
        <View style={[styles.bottomArea, compact && styles.bottomAreaCompact]}>
          <Text style={styles.hint}>CHOOSE ONE AND DROP IT INTO THE VOID</Text>
          <View style={styles.goalsContainer}>
            <DraggableGoal
              label="Deep work"
              onDrop={handleDrop}
              disabled={Boolean(droppedGoal)}
            />
            <DraggableGoal
              label="Nature"
              onDrop={handleDrop}
              disabled={Boolean(droppedGoal)}
            />
            <DraggableGoal
              label="Peace"
              onDrop={handleDrop}
              disabled={Boolean(droppedGoal)}
            />
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  ambientGlow: {
    position: "absolute",
    top: -120,
    right: -130,
    width: 500,
    height: 500,
    transform: [{ rotate: "-12deg" }],
  },
  ambientGradient: {
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.82,
  },
  ambientBlur: {
    ...StyleSheet.absoluteFill,
    borderRadius: 250,
    opacity: 0.2,
  },
  header: {
    paddingTop: 100,
    alignItems: "flex-start",
  },
  headerCompact: {
    paddingTop: 64,
  },
  eyebrow: {
    color: "#ffad74",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  title: {
    width: "100%",
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.white,
    textAlign: "left",
  },
  subtitle: {
    color: "#c5c5c5",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 310,
  },
  targetZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 210,
  },
  targetZoneCompact: {
    minHeight: 180,
  },
  glowHalo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.orange,
    opacity: 0.24,
  },
  targetRing: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: "rgba(255,190,145,0.55)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,10,0.48)",
  },
  targetCore: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  targetEyebrow: {
    color: "#d4b7a5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  targetLabel: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  error: {
    color: colors.rose,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginHorizontal: 28,
    marginBottom: 12,
  },
  bottomArea: {
    paddingBottom: 106,
    alignItems: "center",
  },
  bottomAreaCompact: {
    paddingBottom: 65,
  },
  hint: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#c5c5c5",
    marginBottom: 18,
    textAlign: "center",
  },
  goalsContainer: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    gap: 8,
    zIndex: 10,
  },
  goalPill: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.white20,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  goalArrow: {
    color: "#ffad74",
    fontSize: 17,
    fontWeight: "700",
  },
  goalText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
