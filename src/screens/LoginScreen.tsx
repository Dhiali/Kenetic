import React, { useEffect } from "react";
import { StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

function PulseDot({ color, delay }: { color: string; delay: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(1, { duration: 1000 }),
        ),
        -1,
        false,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color }, style]}
    />
  );
}

export default function LoginScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <Text style={styles.title}>return.</Text>

      <View style={styles.fields}>
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

      <View style={styles.socialRow}>
        <Text style={styles.socialWord}>apple.</Text>
        <Text style={styles.socialWord}>google.</Text>
        <Text style={styles.socialWord}>facebook.</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.welcomeBack}>welcome back</Text>
        <View style={styles.dotsRow}>
          <PulseDot color={colors.green} delay={0} />
          <PulseDot color={colors.rose} delay={500} />
          <PulseDot color={colors.orange} delay={1000} />
        </View>
        <Pressable onPress={onComplete} style={styles.cta}>
          <Text style={styles.ctaText}>jump to dashboard</Text>
          <ChevronRight color={colors.textDark} size={20} />
        </Pressable>
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
    marginBottom: 48,
  },
  fields: {
    gap: 24,
    marginBottom: 48,
  },
  input: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.textDark,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 8,
  },
  socialRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 48,
  },
  socialWord: {
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: -0.5,
    color: "#9ca3af",
  },
  bottom: {
    paddingTop: 16,
  },
  welcomeBack: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 48,
  },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
  },
  ctaText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textDark,
    marginRight: 8,
  },
});
