import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

export default function CompletionRitualScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [isSnapped, setIsSnapped] = useState(false);

  // The draggable word starts 150px below the center
  const translateY = useSharedValue(150);
  const translateX = useSharedValue(0);

  // Wipe animation values
  const wipeScale = useSharedValue(0);
  const wipeOpacity = useSharedValue(1);

  // --------------------------------------------------------
  // Gesture: Dragging the active word to the target
  // --------------------------------------------------------
  const panGesture = Gesture.Pan()
    .enabled(!isSnapped) // Disable drag once it snaps
    .onBegin(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      // 150 is our starting Y offset
      translateX.value = e.translationX;
      translateY.value = 150 + e.translationY;
    })
    .onEnd(() => {
      // If the word is dragged close to the center (0, 0)
      const distanceToCenter = Math.sqrt(
        Math.pow(translateX.value, 2) + Math.pow(translateY.value, 2),
      );

      if (distanceToCenter < 60) {
        // SNAP IT!
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 200 });

        runOnJS(handleSnap)();
      } else {
        // SNAP BACK TO START
        translateX.value = withSpring(0, { damping: 12, stiffness: 150 });
        translateY.value = withSpring(150, { damping: 12, stiffness: 150 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    });

  const handleSnap = () => {
    setIsSnapped(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Trigger the fluid white wipe animation
    wipeScale.value = withTiming(40, { duration: 1200 });
    wipeOpacity.value = withTiming(0, { duration: 1500 });

    // Complete the flow and move to the next screen
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  // --------------------------------------------------------
  // Animated Styles
  // --------------------------------------------------------
  const draggableStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    // Change color to pure white instantly when snapped
    color: isSnapped ? "#ffffff" : "#16a34a",
  }));

  const wipeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wipeScale.value }],
    opacity: wipeOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      {/* 1. The Target (Hollow/Outlined Text) */}
      <View style={styles.centerAnchor}>
        <Text style={styles.targetText}>FINISHED</Text>
      </View>

      {/* 2. The Draggable Active Text */}
      <GestureDetector gesture={panGesture}>
        <Animated.Text style={[styles.activeText, draggableStyle]}>
          finished
        </Animated.Text>
      </GestureDetector>

      {/* 3. The Fluid Wipe Animation (triggers on snap) */}
      {isSnapped && (
        <Animated.View
          style={[styles.wipeCircle, wipeStyle]}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  );
}

// --------------------------------------------------------
// Styles
// --------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  centerAnchor: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  targetText: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    color: "rgba(255, 255, 255, 0.1)", // Simulates the muted hollow outline
    textTransform: "uppercase",
  },
  activeText: {
    position: "absolute",
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    textTransform: "lowercase",
    zIndex: 10,
    // Add padding to make it easier to grab
    padding: 20,
  },
  wipeCircle: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    zIndex: 0,
  },
});
