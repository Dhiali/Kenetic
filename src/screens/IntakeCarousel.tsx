import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

function DraggableGoal({
  label,
  onDrop,
}: {
  label: string;
  onDrop: (label: string) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  const gesture = Gesture.Pan()
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

      // Dragged up into the target circle area
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

  const circleScale = useSharedValue(1);
  const circleOpacity = useSharedValue(0.15);

  useEffect(() => {
    circleScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
    circleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 2000 }),
        withTiming(0.15, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));

  const handleDrop = (label: string) => {
    setDroppedGoal(label);
    circleScale.value = withTiming(3, { duration: 500 });
    circleOpacity.value = withTiming(0, { duration: 500 });

    setTimeout(onComplete, 600);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <Text style={styles.title}>
        {droppedGoal ? `${droppedGoal.toLowerCase()}.` : "what demands\nyour focus?"}
      </Text>

      <View style={styles.targetZone}>
        <Animated.View style={[styles.glowingCircle, circleStyle]} />
      </View>

      {!droppedGoal && (
        <View style={styles.bottomArea}>
          <Text style={styles.hint}>drag item up into circle</Text>
          <View style={styles.goalsContainer}>
            <DraggableGoal label="Deep Work" onDrop={handleDrop} />
            <DraggableGoal label="Nature" onDrop={handleDrop} />
            <DraggableGoal label="Peace" onDrop={handleDrop} />
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
    padding: 32,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.textDark,
    marginTop: 40,
    lineHeight: 52,
  },
  targetZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glowingCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.black,
  },
  bottomArea: {
    paddingBottom: 40,
    alignItems: "flex-start",
  },
  hint: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 24,
  },
  goalsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    zIndex: 10,
  },
  goalPill: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 30,
  },
  goalText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});