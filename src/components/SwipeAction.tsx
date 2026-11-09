import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type Props = {
  label: string;
  onActivate: () => void;
  disabled?: boolean;
  tone?: "dark" | "light";
};

export default function SwipeAction({ label, onActivate, disabled = false, tone = "dark" }: Props) {
  const offset = useSharedValue(0);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      offset.value = Math.max(0, Math.min(80, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX >= 60) runOnJS(onActivate)();
      offset.value = withSpring(0);
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint="Swipe right to activate, or use the activate accessibility action."
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate", label: `Activate ${label}` }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === "activate") onActivate();
        }}
        onAccessibilityTap={() => {
          if (!disabled) onActivate();
        }}
        style={[styles.action, animatedStyle, disabled && styles.disabled]}
      >
        <Text style={[styles.label, tone === "light" && styles.lightLabel]}>{label}</Text>
        <Text style={[styles.hint, tone === "light" && styles.lightHint]}>drag right →</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  action: { paddingVertical: 16, minHeight: 48, alignSelf: "flex-start" },
  disabled: { opacity: 0.45 },
  label: { color: "#bef264", fontSize: 16, fontWeight: "700" },
  hint: { color: "#a3b6a3", fontSize: 12, marginTop: 4 },
  lightLabel: { color: "#285919" },
  lightHint: { color: "#425342" },
});
