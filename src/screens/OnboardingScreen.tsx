import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const triggerImpact = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => undefined);
};

export default function FinishedScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [isSnapped, setIsSnapped] = useState(false);

  // Drag physics states
  const dragTranslateY = useSharedValue(150); // Starts 150px below the target
  const dragTranslateX = useSharedValue(0);

  const textColor = useSharedValue("#16a34a"); // Starts green

  // Morphing background blob state
  const gateBlobProgress = useSharedValue(0);

  useEffect(() => {
    // Splash-style morphing blob animation running continuously in the background
    gateBlobProgress.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  // --------------------------------------------------------
  // GESTURE: Puzzle Piece Snap
  // --------------------------------------------------------
  const dragGesture = Gesture.Pan()
    .enabled(!isSnapped)
    .onBegin(() => {
      runOnJS(triggerImpact)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      dragTranslateX.value = e.translationX;
      dragTranslateY.value = 150 + e.translationY;
    })
    .onEnd(() => {
      const distanceToCenter = Math.sqrt(
        Math.pow(dragTranslateX.value, 2) + Math.pow(dragTranslateY.value, 2),
      );

      // Allow a forgiving release area around the target word.
      if (distanceToCenter < 90) {
        // SNAP IT IN PLACE! (0, 0 aligns it perfectly over the target word)
        dragTranslateX.value = withSpring(0, { damping: 15, stiffness: 300 });
        dragTranslateY.value = withSpring(0, { damping: 15, stiffness: 300 });
        textColor.value = "#ffffff"; // Fill state (turns white)

        runOnJS(onComplete)();
      } else {
        // SNAP BACK TO START
        dragTranslateX.value = withSpring(0, { damping: 12, stiffness: 150 });
        dragTranslateY.value = withSpring(150, { damping: 12, stiffness: 150 });
        runOnJS(triggerImpact)(Haptics.ImpactFeedbackStyle.Light);
      }
    });

  // --------------------------------------------------------
  // ANIMATED STYLES
  // --------------------------------------------------------
  const draggableStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragTranslateX.value },
      { translateY: dragTranslateY.value },
    ],
    color: textColor.value,
  }));

  // Morphing Splash Gradient Style
  const gateBlobAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      gateBlobProgress.value,
      [0, 0.5, 1],
      [1, 1.2, 1.5],
    );
    const borderTopLeftRadius = interpolate(
      gateBlobProgress.value,
      [0, 0.5, 1],
      [102, 153, 128],
    );
    const borderTopRightRadius = interpolate(
      gateBlobProgress.value,
      [0, 0.5, 1],
      [153, 102, 128],
    );
    const borderBottomRightRadius = interpolate(
      gateBlobProgress.value,
      [0, 0.5, 1],
      [179, 76, 128],
    );
    const borderBottomLeftRadius = interpolate(
      gateBlobProgress.value,
      [0, 0.5, 1],
      [76, 179, 128],
    );

    const backgroundColor = interpolateColor(
      gateBlobProgress.value,
      [0, 0.5, 1],
      ["#16a34a", "#e11d48", "#f97316"],
    );
    const rotate = `${interpolate(gateBlobProgress.value, [0, 0.5, 1], [0, 90, 180])}deg`;

    return {
      transform: [{ scale }, { rotate }],
      backgroundColor,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomRightRadius,
      borderBottomLeftRadius,
    };
  });

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(600)}
      style={styles.container}
    >
      {/* 1. Splash-style morphing gradient behind the text */}
      <Animated.View style={[styles.gateBlob, gateBlobAnimatedStyle]} />

      {/* 2. Full-screen blur to eliminate the "square" box edges and turn it into soft smoke */}
      <BlurView
        intensity={100}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />

      {/* Text Wrapper guarantees absolute pixel-perfect overlap */}
      <View style={styles.textWrapper}>
        {/* 3. Hollow Target (Deactivated puzzle piece) */}
        <Text style={styles.targetText}>finished</Text>

        {/* 4. Draggable Active Text (Active puzzle piece) */}
        <GestureDetector gesture={dragGesture}>
          {/* We use hitSlop so it's easy to grab without messing up the visual dimensions */}
          <Animated.Text style={[styles.activeText, draggableStyle]}>
            finished
          </Animated.Text>
        </GestureDetector>
      </View>
      <Text style={styles.dragInstruction}>drag and drop to complete</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  gateBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    opacity: 0.7,
  },
  textWrapper: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  targetText: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    color: "rgba(255, 255, 255, 0.15)", // Muted hollow outline
    textTransform: "lowercase",
  },
  activeText: {
    position: "absolute",
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    textTransform: "lowercase",
  },
  dragInstruction: {
    position: "absolute",
    bottom: 72,
    maxWidth: 260,
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    lineHeight: 18,
    textAlign: "center",
    textTransform: "uppercase",
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
