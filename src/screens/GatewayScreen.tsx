import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import Animated, {
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

export default function GatewayScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const y = useSharedValue(0);
  const chevronY = useSharedValue(0);

  useEffect(() => {
    chevronY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1000 }),
        withTiming(0, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, []);

  const complete = () => {
    hapticLight();
    onComplete();
  };

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY < -150) {
        runOnJS(complete)();
      } else {
        y.value = withSpring(0);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: 1 - Math.min(1, -y.value / 200),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chevronY.value }, { rotate: "-90deg" }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        exiting={FadeOut.duration(500)}
        style={[styles.container, containerStyle]}
      >
        <View style={styles.glowWrap}>
          <LinearGradient
            colors={[colors.green, colors.orange, colors.rose]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glow}
          />
        </View>
        <Text style={styles.title}>centered.</Text>
        <View style={styles.bottom}>
          <Animated.View style={chevronStyle}>
            <ChevronRight color={colors.white50} size={22} />
          </Animated.View>
          <Text style={styles.hint}>flick up</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glowWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    width: 384,
    height: 384,
    borderRadius: 192,
    opacity: 0.4,
  },
  title: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.white,
  },
  bottom: {
    position: "absolute",
    bottom: 64,
    alignItems: "center",
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.white50,
  },
});
