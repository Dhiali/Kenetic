import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import {
    CryptoDigestAlgorithm,
    digestStringAsync,
    randomUUID,
} from "expo-crypto";
import { Apple, ChevronRight, Chrome } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
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
import {
    loginWithEmailAccount,
    loginWithProviderAccount,
} from "../lib/firebase/bootstrap";
import {
    googleAndroidClientId,
    googleIosClientId,
    googleWebClientId,
} from "../lib/firebase/config";
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

export default function LoginScreen({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    clientId: googleWebClientId ?? undefined,
    androidClientId: googleAndroidClientId ?? undefined,
    iosClientId: googleIosClientId ?? undefined,
    webClientId: googleWebClientId ?? undefined,
    selectAccount: true,
  });
  const backX = useSharedValue(0);
  const submitX = useSharedValue(0);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
      setSubmitting(false);
      return;
    }
    if (googleResponse.type !== "success") {
      setErrors({ form: "Google sign in could not be completed." });
      setSubmitting(false);
      return;
    }
    const token = googleResponse.authentication?.accessToken;
    if (!token) {
      setErrors({ form: "Google did not return an access token." });
      setSubmitting(false);
      return;
    }
    void loginWithProviderAccount("google", token)
      .then(onComplete)
      .catch((error) => setErrors({ form: firebaseErrorMessage(error) }))
      .finally(() => setSubmitting(false));
  }, [googleResponse, onComplete]);

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
    if (!validate() || submitting) {
      submitX.value = withSpring(0);
      return;
    }
    setSubmitting(true);
    hapticLight();
    try {
      await loginWithEmailAccount(email, password);
      onComplete();
    } catch (error) {
      setErrors({ form: firebaseErrorMessage(error) });
      submitX.value = withSpring(0);
    } finally {
      setSubmitting(false);
    }
  };

  const startGoogle = async () => {
    if (submitting) return;
    if (!googleWebClientId && !googleAndroidClientId && !googleIosClientId) {
      setErrors({ form: "Google sign in needs a configured OAuth client ID." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    hapticLight();
    try {
      await promptGoogle();
    } catch (error) {
      setErrors({ form: firebaseErrorMessage(error) });
      setSubmitting(false);
    }
  };

  const startApple = async () => {
    if (submitting) return;
    if (Platform.OS !== "ios") {
      setErrors({ form: "Apple sign in is available on iPhone and iPad." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    hapticLight();
    try {
      const rawNonce = randomUUID();
      const hashedNonce = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
      });
      if (!credential.identityToken)
        throw new Error("Apple did not return a valid identity token.");
      await loginWithProviderAccount(
        "apple",
        credential.identityToken,
        rawNonce,
      );
      onComplete();
    } catch (error) {
      if ((error as { code?: string }).code !== "ERR_REQUEST_CANCELED")
        setErrors({ form: firebaseErrorMessage(error) });
    } finally {
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
          showsVerticalScrollIndicator={false}
        >
          {onBack && (
            <GestureDetector gesture={backGesture}>
              <Animated.Text style={[styles.backLink, backStyle]}>
                where to? →
              </Animated.Text>
            </GestureDetector>
          )}
          <Text style={styles.title}>return.</Text>
          <Text style={styles.intro}>
            Come back to your practices, your attention, and the way you want to
            meet the day.
          </Text>
          <View style={styles.fields}>
            <TextInput
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
              placeholder="email"
              placeholderTextColor={colors.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            {!!errors.email && <Text style={styles.error}>{errors.email}</Text>}
            <TextInput
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
              placeholder="password"
              placeholderTextColor={colors.gray400}
              secureTextEntry
              style={styles.input}
            />
            {!!errors.password && (
              <Text style={styles.error}>{errors.password}</Text>
            )}
          </View>
          <View style={styles.socialButtons}>
            <Pressable
              onPress={() => void startGoogle()}
              disabled={submitting}
              style={styles.socialButton}
            >
              <Chrome color={colors.white} size={18} />
              <Text style={styles.socialText}>continue with google</Text>
            </Pressable>
            <Pressable
              onPress={() => void startApple()}
              disabled={submitting}
              style={styles.socialButton}
            >
              <Apple color={colors.white} size={18} />
              <Text style={styles.socialText}>continue with apple</Text>
            </Pressable>
          </View>
          {!!errors.form && <Text style={styles.error}>{errors.form}</Text>}
          <View style={styles.bottom}>
            <Text style={styles.welcome}>welcome back</Text>
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
                  <Animated.View style={[styles.submitKnob, submitStyle]}>
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
              swipe right to jump to dashboard
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
  socialButtons: { gap: 10, marginTop: 28 },
  socialButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.white20,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  socialText: { color: colors.white, fontSize: 13, fontWeight: "700" },
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
