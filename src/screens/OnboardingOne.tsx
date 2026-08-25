import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";

export default function PresenceScreen({ onComplete }: { onComplete: () => void }) {
  const [isFinished, setIsFinished] = useState(false);
  
  // Tracks how much of the fog has been wiped away (0 to 1)
  const clearProgress = useSharedValue(0);
  
  // Tracks the last haptic milestone so we don't spam the vibration motor
  const lastHapticThreshold = useSharedValue(0);

  // Background blob animations
  const blobScale = useSharedValue(1);
  const blobOpacity = useSharedValue(0.8); // Added opacity state for the fade out

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
  // Gesture: Scrubbing the screen to clear the fog
  // --------------------------------------------------------
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isFinished) return;

      // Accumulate progress based on movement speed/distance.
      const newProgress = Math.min(1, clearProgress.value + 0.002);
      clearProgress.value = newProgress;

      // Fire a subtle physical "grinding" haptic every 10% cleared
      if (newProgress - lastHapticThreshold.value > 0.1) {
        lastHapticThreshold.value = newProgress;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }

      // If fully cleared, trigger the end sequence
      if (newProgress >= 1) {
        runOnJS(handleComplete)();
      }
    });

  const handleComplete = () => {
    if (isFinished) return;
    setIsFinished(true);
    
    // Final heavy click to signify clarity
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // FADE OUT THE BLOB
    blobOpacity.value = withTiming(0, { duration: 800 });
    
    // Pause so they experience the pitch-black clarity before routing
    setTimeout(() => {
      onComplete();
    }, 1200);
  };

  // --------------------------------------------------------
  // Animated Styles
  // --------------------------------------------------------
  
  // The fog layer fades out as progress approaches 1
  const fogStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clearProgress.value, [0, 1], [1, 0]),
  }));

  // The text fades out slightly faster than the fog so it disappears first
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clearProgress.value, [0, 0.7], [1, 0]),
    transform: [
      { scale: interpolate(clearProgress.value, [0, 1], [1, 1.1]) }
    ]
  }));

  // The background blob incorporates the new fade-out opacity
  const blobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: blobScale.value }],
    opacity: blobOpacity.value,
  }));

  return (
    <Animated.View 
      entering={FadeIn.duration(800)} 
      exiting={FadeOut.duration(600)} 
      style={styles.container}
    >
      {/* 1. The Distraction / Noise Blob */}
      <Animated.View style={[styles.blob, blobStyle]} />

      {/* 2. The Interactive Fog Layer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.fogContainer, fogStyle]}>
          
          <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          
          <View style={styles.frostOverlay} />

          {/* Typography floating in the fog */}
          <Animated.View style={[styles.textContainer, textStyle]}>
            <Text style={styles.title}>presence{"\n"}required.</Text>
            <Text style={styles.subtitle}>wipe the screen to clear the noise.</Text>
          </Animated.View>

        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// --------------------------------------------------------
// Styles
// --------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', 
    justifyContent: "center",
    alignItems: "center",
  },
  blob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#f97316", // Sunrise Orange
  },
  fogContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: "center",
    alignItems: "center",
    position: 'absolute',
  },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)', 
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
  },
  title: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.textDark,
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
  }
});