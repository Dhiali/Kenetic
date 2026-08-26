import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
      <Animated.View style={[styles.goalPill, animatedStyle]}>
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
    if (droppedGoal) return;

    setDroppedGoal(label);
    setSaveError(null);
    circleScale.value = withTiming(3, { duration: 500 });
    circleOpacity.value = withTiming(0, { duration: 500 });

    try {
      await persistInitialIntention(label);
      setTimeout(onComplete, 600);
    } catch (error) {
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
      <View style={styles.ambientGlow}>
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

      <View style={styles.header}>
        <Text style={styles.eyebrow}>your first intention</Text>
        <Text style={styles.title}>
          {droppedGoal
            ? `${droppedGoal.toLowerCase()}.`
            : "What demands\nyour focus?"}
        </Text>
        <Text style={styles.subtitle}>
          Choose one thing to bring into the center of your day.
        </Text>
      </View>

      <View style={styles.targetZone}>
        <Animated.View style={[styles.glowHalo, circleStyle]} />
        <View style={styles.targetRing}>
          <View style={styles.targetCore}>
            <Text style={styles.targetLabel}>
              {droppedGoal ? droppedGoal.toLowerCase() : "place here"}
            </Text>
          </View>
        </View>
      </View>

      {saveError && <Text style={styles.error}>{saveError}</Text>}

      {!droppedGoal && (
        <View style={styles.bottomArea}>
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
    paddingHorizontal: 28,
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
    ...StyleSheet.absoluteFillObject,
    borderRadius: 250,
    opacity: 0.2,
  },
  header: {
    paddingTop: 112,
    alignItems: "flex-start",
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  title: {
    width: "100%",
    fontSize: 44,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.white,
    textAlign: "left",
  },
  subtitle: {
    color: colors.white50,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 310,
  },
  targetZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 250,
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
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,10,0.32)",
  },
  targetCore: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  targetLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  targetHint: {
    color: colors.white40,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 20,
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
    paddingBottom: 42,
    alignItems: "center",
  },
  hint: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.white50,
    marginBottom: 14,
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
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.white20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  goalText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
