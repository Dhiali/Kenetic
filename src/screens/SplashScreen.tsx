import { BlurView } from "expo-blur";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export default function SplashScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const containerOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(10);
  const blobProgress = useSharedValue(0);

  useEffect(() => {
    containerOpacity.value = withTiming(1, {
      duration: 1500,
      easing: Easing.inOut(Easing.ease),
    });

    textOpacity.value = withDelay(500, withTiming(1, { duration: 1000 }));
    textTranslateY.value = withDelay(500, withTiming(0, { duration: 1000 }));

    // Animate through the 3 phases of the blob over 4 seconds
    blobProgress.value = withTiming(1, {
      duration: 4000,
      easing: Easing.inOut(Easing.ease),
    });

    const timer = setTimeout(() => {
      onComplete();
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const blobAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(blobProgress.value, [0, 0.5, 1], [1, 1.2, 5]);

    // Morphing Asymmetrical Shape
    const borderTopLeftRadius = interpolate(
      blobProgress.value,
      [0, 0.5, 1],
      [102, 153, 128],
    );
    const borderTopRightRadius = interpolate(
      blobProgress.value,
      [0, 0.5, 1],
      [153, 102, 128],
    );
    const borderBottomRightRadius = interpolate(
      blobProgress.value,
      [0, 0.5, 1],
      [179, 76, 128],
    );
    const borderBottomLeftRadius = interpolate(
      blobProgress.value,
      [0, 0.5, 1],
      [76, 179, 128],
    );

    const backgroundColor = interpolateColor(
      blobProgress.value,
      [0, 0.5, 1],
      ["#16a34a", "#e11d48", "#f97316"],
    );

    const rotate = `${interpolate(blobProgress.value, [0, 0.5, 1], [0, 90, 180])}deg`;

    return {
      transform: [{ scale }, { rotate }],
      backgroundColor,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomRightRadius,
      borderBottomLeftRadius,
      // Removed the fake shadow - the BlurView handles the diffusion now!
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* 1. The Raw Morphing Shape */}
      <Animated.View style={[styles.blob, blobAnimatedStyle]} />

      {/* 2. The Diffuser: Blurs everything behind it into pure smoke */}
      {/* Note: tint="dark" blends perfectly into our #121212 background */}
      <BlurView intensity={120} tint="dark" style={StyleSheet.absoluteFill} />

      {/* 3. The Typography: Crisp and layered on top of the smoke */}
      <Animated.Text style={[styles.text, textAnimatedStyle]}>
        kenetic.
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 256,
    height: 256,
    // Slightly higher base opacity since the BlurView will wash it out
    opacity: 0.8,
  },
  text: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    color: "#ffffff",
    zIndex: 10,
  },
});
