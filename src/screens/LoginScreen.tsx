import { ChevronRight } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { loginWithEmailAccount } from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

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
    <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
  );
}

type LoginScreenProps = {
  onComplete: () => Promise<void>;
  onBack?: () => void;
};

export default function LoginScreen({
  onComplete,
  onBack,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const emailSubmissionInProgress = useRef(false);
  const backX = useSharedValue(0);
  const submitX = useSharedValue(0);

  const validate = () => {
    const next: typeof errors = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) next.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const signIn = async () => {
    if (emailSubmissionInProgress.current || submitting || !validate()) {
      submitX.value = withSpring(0);
      return;
    }
    emailSubmissionInProgress.current = true;
    setSubmitting(true);
    hapticLight();
    try {
      await loginWithEmailAccount(email, password);
      await onComplete();
    } catch (error) {
      setErrors({ form: firebaseErrorMessage(error) });
      submitX.value = withSpring(0);
    } finally {
      emailSubmissionInProgress.current = false;
      setSubmitting(false);
    }
  };

  const backGesture = Gesture.Pan()
    .enabled(Boolean(onBack))
    .onUpdate((event) => {
      backX.value = Math.max(0, Math.min(110, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX > 70 && onBack) runOnJS(onBack)();
      else backX.value = withSpring(0);
    });
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: backX.value }],
  }));
  const submitGesture = Gesture.Pan()
    .enabled(!submitting)
    .onUpdate((event) => {
      submitX.value = Math.max(0, Math.min(86, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX > 60) {
        submitX.value = withSpring(86);
        runOnJS(signIn)();
      } else submitX.value = withSpring(0);
    });
  const submitStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: submitX.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          alwaysBounceVertical
          showsVerticalScrollIndicator={false}
        >
          {onBack && (
            <GestureDetector gesture={backGesture}>
              <Animated.View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Back to account options"
                accessibilityActions={[{ name: "activate", label: "Go back" }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "activate") onBack();
                }}
                onAccessibilityTap={onBack}
                style={backStyle}
              >
                <Text style={styles.backLink}>Where to? →</Text>
              </Animated.View>
            </GestureDetector>
          )}
          <Text style={styles.title}>Return.</Text>
          <Text style={styles.intro}>
            Come back to your practices, your attention, and the way you want to
            meet the day.
          </Text>
          <View style={styles.fields}>
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({
                  ...current,
                  email: undefined,
                  form: undefined,
                }));
              }}
              onBlur={validate}
              placeholder="Email"
              placeholderTextColor={colors.gray400}
              keyboardType="email-address"
              returnKeyType="done"
              autoCapitalize="none"
              style={styles.input}
            />
            {!!errors.email && <Text style={styles.error}>{errors.email}</Text>}
            <TextInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({
                  ...current,
                  password: undefined,
                  form: undefined,
                }));
              }}
              onBlur={validate}
              placeholder="Password"
              placeholderTextColor={colors.gray400}
              secureTextEntry
              style={styles.input}
            />
            {!!errors.password && (
              <Text style={styles.error}>{errors.password}</Text>
            )}
          </View>
          {!!errors.form && <Text style={styles.error}>{errors.form}</Text>}
          <View style={styles.bottom}>
            <Text style={styles.welcome}>Welcome back</Text>
            <View style={styles.actionRow}>
              <View style={styles.dots}>
                <PulseDot color={colors.green} delay={0} />
                <PulseDot color={colors.rose} delay={500} />
                <PulseDot color={colors.orange} delay={1000} />
              </View>
              <View style={styles.submitTrack}>
                <View style={styles.submitTarget}>
                  <ChevronRight color={colors.white50} size={18} />
                </View>
                <GestureDetector gesture={submitGesture}>
                  <Animated.View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Sign in"
                    accessibilityHint="Activate to sign in with your email and password."
                    accessibilityState={{ disabled: submitting }}
                    accessibilityActions={[{ name: "activate", label: "Sign in" }]}
                    onAccessibilityAction={(event) => {
                      if (!submitting && event.nativeEvent.actionName === "activate") void signIn();
                    }}
                    onAccessibilityTap={() => { if (!submitting) void signIn(); }}
                    style={[styles.submitKnob, submitStyle]}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <ChevronRight color={colors.white} size={20} />
                    )}
                  </Animated.View>
                </GestureDetector>
              </View>
            </View>
            <Text style={styles.submitHint}>
              Swipe right to jump to dashboard
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark, padding: 32 },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingBottom: 48 },
  backLink: {
    color: colors.white50,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 68,
    top: 48,
  },
  title: {
    color: colors.white,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 22,
  },
  intro: {
    color: colors.white50,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 32,
  },
  fields: { gap: 12 },
  input: {
    color: colors.white,
    fontSize: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.white20,
    paddingVertical: 10,
  },
  error: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: -4 },
  bottom: { paddingTop: 38, alignItems: "flex-start" },
  welcome: {
    color: colors.white50,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 14,
  },
  dot: { width: 34, height: 34, borderRadius: 17 },
  submitTrack: { width: 132, height: 48, justifyContent: "center" },
  submitTarget: {
    position: "absolute",
    right: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.white30,
    alignItems: "center",
    justifyContent: "center",
  },
  submitKnob: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  submitHint: {
    color: colors.white40,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 12,
  },
});
