import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

export default function SignupScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const x = useSharedValue(0);

  const complete = () => {
    setAgreed(true);
    hapticLight();
    setTimeout(onComplete, 500);
  };

  const gesture = Gesture.Pan()
    .enabled(!agreed)
    .onUpdate((e) => {
      x.value = Math.min(80, Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > 60) {
        x.value = withSpring(80);
        runOnJS(complete)();
      } else {
        x.value = withSpring(0);
      }
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <Text style={styles.title}>begin.</Text>

      <View style={styles.fields}>
        <TextInput
          placeholder="name"
          placeholderTextColor={colors.gray400}
          style={styles.input}
        />
        <TextInput
          placeholder="surname"
          placeholderTextColor={colors.gray400}
          style={styles.input}
        />
        <TextInput
          placeholder="email"
          placeholderTextColor={colors.gray400}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="password"
          placeholderTextColor={colors.gray400}
          secureTextEntry
          style={styles.input}
        />
      </View>

      <View style={styles.bottom}>
        <Text style={styles.hint}>drag to agree to terms</Text>
        <View style={styles.track}>
          <View style={styles.trackDashed} />
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.knob, knobStyle]}>
              <ChevronRight color={colors.white} size={20} />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
    padding: 32,
    justifyContent: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.textDark,
    marginBottom: 32,
  },
  fields: {
    gap: 24,
  },
  input: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.textDark,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 8,
  },
  bottom: {
    paddingTop: 48,
  },
  hint: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 24,
  },
  track: {
    width: 128,
    height: 48,
    justifyContent: "center",
  },
  trackDashed: {
    position: "absolute",
    right: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
  },
  knob: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
});
