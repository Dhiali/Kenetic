import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  // Track which interaction is active (1 = Fog, 2 = Snap)
  const [phase, setPhase] = useState(1);

  // --------------------------------------------------------
  // SCREEN 1: FOG SHARED VALUES
  // --------------------------------------------------------
  const clearProgress = useSharedValue(0);
  const lastHapticThreshold = useSharedValue(0);
  const isFogCleared = useSharedValue(false);
  
  const blobScale = useSharedValue(1);
  const blobOpacity = useSharedValue(0.8);

  useEffect(() => {
    blobScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 3000 }),
        withTiming(1, { duration: 3000 })
      ),
      -1,
      true
    );
  }, []);

  // --------------------------------------------------------
  // SCREEN 2: SNAP SHARED VALUES
  // --------------------------------------------------------
  const screenTwoOpacity = useSharedValue(0);
  const isSnapped = useSharedValue(false);
  const translateY = useSharedValue(150);
  const translateX = useSharedValue(0);
  const wipeScale = useSharedValue(0);
  const wipeOpacity = useSharedValue(1);

  // --------------------------------------------------------
  // GESTURE 1: FOG WIPE
  // --------------------------------------------------------
  const fogGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isFogCleared.value) return;

      const newProgress = Math.min(1, clearProgress.value + 0.002);
      clearProgress.value = newProgress;

      if (newProgress - lastHapticThreshold.value > 0.1) {
        lastHapticThreshold.value = newProgress;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }

      if (newProgress >= 1) {
        isFogCleared.value = true; // Lock gesture purely on UI thread
        runOnJS(transitionToScreenTwo)();
      }
    });

  const transitionToScreenTwo = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Fade out the orange blob
    blobOpacity.value = withTiming(0, { duration: 800 });

    // Wait in the dark, then fade in the second screen
    setTimeout(() => {
      setPhase(2); // Enable touches for screen 2
      screenTwoOpacity.value = withTiming(1, { duration: 800 });
    }, 1200);
  };

  // --------------------------------------------------------
  // GESTURE 2: WORD SNAP
  // --------------------------------------------------------
  const snapGesture = Gesture.Pan()
    .enabled(phase === 2 && !isSnapped.value) // Only allow drag in phase 2
    .onBegin(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = 150 + e.translationY;
    })
    .onEnd(() => {
      const distanceToCenter = Math.sqrt(
        Math.pow(translateX.value, 2) + Math.pow(translateY.value, 2)
      );

      if (distanceToCenter < 60) {
        // SNAP IT!
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
        isSnapped.value = true;
        runOnJS(handleFinalSnap)();
      } else {
        // SNAP BACK TO START
        translateX.value = withSpring(0, { damping: 12, stiffness: 150 });
        translateY.value = withSpring(150, { damping: 12, stiffness: 150 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    });

  const handleFinalSnap = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Trigger fluid white wipe
    wipeScale.value = withTiming(40, { duration: 1200 });
    wipeOpacity.value = withTiming(0, { duration: 1500 });

    // Complete the entire flow and go to Dashboard
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  // --------------------------------------------------------
  // ANIMATED STYLES
  // --------------------------------------------------------
  const fogStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clearProgress.value, [0, 1], [1, 0]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clearProgress.value, [0, 0.7], [1, 0]),
    transform: [{ scale: interpolate(clearProgress.value, [0, 1], [1, 1.1]) }],
  }));

  const blobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: blobScale.value }],
    opacity: blobOpacity.value,
  }));

  const screenTwoStyle = useAnimatedStyle(() => ({
    opacity: screenTwoOpacity.value,
  }));

  const draggableStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    color: isSnapped.value ? "#ffffff" : "#16a34a",
  }));

  const wipeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wipeScale.value }],
    opacity: wipeOpacity.value,
  }));

  return (
    <View style={styles.container}>
      
      {/* ==================== SCREEN 1 (FOG) ==================== */}
      <View 
        style={styles.absoluteCenter} 
        pointerEvents={phase === 1 ? "auto" : "none"} // Disables touches after completion
      >
        <Animated.View style={[styles.blob, blobStyle]} />

        <GestureDetector gesture={fogGesture}>
          <Animated.View style={[styles.fogContainer, fogStyle]}>
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.frostOverlay} />

            <Animated.View style={[styles.textContainer, textStyle]}>
              <Text style={styles.title}>presence{"\n"}required.</Text>
              <Text style={styles.subtitle}>wipe the screen to clear the noise.</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* ==================== SCREEN 2 (SNAP) ==================== */}
      <Animated.View 
        style={[styles.absoluteCenter, screenTwoStyle]}
        pointerEvents={phase === 2 ? "auto" : "none"} // Enables touches only in phase 2
      >
        <View style={styles.centerAnchor}>
          <Text style={styles.targetText}>FINISHED</Text>
        </View>

        <GestureDetector gesture={snapGesture}>
          <Animated.Text style={[styles.activeText, draggableStyle]}>
            finished
          </Animated.Text>
        </GestureDetector>

        <Animated.View style={[styles.wipeCircle, wipeStyle]} pointerEvents="none" />
      </Animated.View>

    </View>
  );
}

// --------------------------------------------------------
// STYLES
// --------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  absoluteCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  blob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#f97316",
  },
  fogContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 10,
  },
  title: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    color: "#111", // Fallback if colors.textDark is missing
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 60,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(0, 0, 0, 0.5)",
    textAlign: "center",
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
    color: "rgba(255, 255, 255, 0.1)",
    textTransform: "uppercase",
  },
  activeText: {
    position: "absolute",
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    textTransform: "lowercase",
    zIndex: 10,
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