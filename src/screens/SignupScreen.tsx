import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { randomUUID } from "expo-crypto";
import { Apple, ChevronRight, Chrome } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
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
  withSpring,
} from "react-native-reanimated";
import { registerProviderAccount } from "../lib/firebase/bootstrap";
import {
  googleAndroidClientId,
  googleIosClientId,
  googleWebClientId,
} from "../lib/firebase/config";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";
import {
  SignupErrors,
  SignupValues,
  validateSignup,
} from "../utils/signupValidation";

export default function SignupScreen({
  onComplete,
  onBack,
  onSubmit,
}: {
  onComplete: () => void;
  onBack?: () => void;
  onSubmit?: (values: SignupValues) => Promise<void>;
}) {
  const [values, setValues] = useState<SignupValues>({
    name: "",
    surname: "",
    email: "",
    password: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    androidClientId: googleAndroidClientId ?? undefined,
    iosClientId: googleIosClientId ?? undefined,
    webClientId: googleWebClientId ?? undefined,
    selectAccount: true,
  });
  const x = useSharedValue(0);
  const backX = useSharedValue(0);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
      setSubmitting(false);
      return;
    }
    if (googleResponse.type !== "success") {
      setErrors({ form: "Google sign up could not be completed." });
      setSubmitting(false);
      return;
    }

    const accessToken = googleResponse.authentication?.accessToken;
    if (!accessToken) {
      setErrors({ form: "Google did not return an access token." });
      setSubmitting(false);
      return;
    }

    void registerProviderAccount("google", accessToken)
      .then(onComplete)
      .catch((error) => setErrors({ form: firebaseErrorMessage(error) }))
      .finally(() => setSubmitting(false));
  }, [googleResponse, onComplete]);

  const startGoogleSignup = async () => {
    if (!googleRequest || submitting) return;
    if (!googleAndroidClientId && !googleIosClientId && !googleWebClientId) {
      setErrors({
        form: "Google sign up needs a configured OAuth client ID first.",
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    hapticLight();
    await promptGoogle();
  };

  const startAppleSignup = async () => {
    if (submitting) return;
    if (Platform.OS !== "ios") {
      setErrors({ form: "Apple sign up is available on iPhone and iPad." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    hapticLight();
    try {
      const rawNonce = randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        nonce: rawNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple did not return a valid identity token.");
      }
      await registerProviderAccount(
        "apple",
        credential.identityToken,
        credential.fullName
          ? AppleAuthentication.formatFullName(credential.fullName)
          : undefined,
        credential.email,
        rawNonce,
      );
      onComplete();
    } catch (error) {
      if ((error as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        setErrors({ form: firebaseErrorMessage(error) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const complete = async (submittedValues = values) => {
    const nextErrors = validateSignup(submittedValues);
    setValues(submittedValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || submitting) {
      x.value = withSpring(0, { damping: 15, stiffness: 200 });
      return;
    }

    setSubmitting(true);
    hapticLight();
    try {
      if (onSubmit) await onSubmit(submittedValues);
      else onComplete();
    } catch (error) {
      setErrors({ form: firebaseErrorMessage(error) });
      x.value = withSpring(0, { damping: 15, stiffness: 200 });
    } finally {
      setSubmitting(false);
    }
  };

  const gesture = Gesture.Pan()
    .enabled(!submitting)
    .onUpdate((e) => {
      x.value = Math.min(80, Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > 60) {
        x.value = withSpring(80);
        runOnJS(complete)({ ...values, termsAccepted: true });
      } else {
        x.value = withSpring(0);
      }
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const updateField = (field: keyof SignupValues, value: string) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  };

  const validateField = (field: keyof SignupValues) => {
    const nextErrors = validateSignup(values);
    setErrors((current) => ({ ...current, [field]: nextErrors[field] }));
  };

  const backGesture = Gesture.Pan()
    .activeOffsetX(10)
    .onUpdate((event) => {
      if (event.translationX > 0) backX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > 70 && onBack) runOnJS(onBack)();
      else backX.value = withSpring(0, { damping: 15, stiffness: 200 });
    });

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: backX.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {onBack && (
            <GestureDetector gesture={backGesture}>
              <Animated.Text style={[styles.backLink, backStyle]}>
                ← Where to?
              </Animated.Text>
            </GestureDetector>
          )}
          <Text style={styles.title}>Begin.</Text>
          <Text style={styles.intro}>
            Find curiosity in everyday life, stay centered in the moment and
            move forward with renewed attention.
          </Text>

          <View style={styles.socialButtons}>
            <Pressable
              onPress={() => void startGoogleSignup()}
              disabled={submitting}
              style={styles.socialButton}
            >
              <Chrome color={colors.white} size={18} />
              <Text style={styles.socialButtonText}>continue with google</Text>
            </Pressable>
            <Pressable
              onPress={() => void startAppleSignup()}
              disabled={submitting}
              style={styles.socialButton}
            >
              <Apple color={colors.white} size={18} />
              <Text style={styles.socialButtonText}>continue with apple</Text>
            </Pressable>
          </View>

          <View style={styles.fields}>
            <TextInput
              value={values.name}
              onChangeText={(value) => updateField("name", value)}
              onBlur={() => validateField("name")}
              placeholder="Name"
              placeholderTextColor={colors.gray400}
              style={styles.input}
            />
            {!!errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
            <TextInput
              value={values.surname}
              onChangeText={(value) => updateField("surname", value)}
              onBlur={() => validateField("surname")}
              placeholder="Surname"
              placeholderTextColor={colors.gray400}
              style={styles.input}
            />
            {!!errors.surname && (
              <Text style={styles.errorText}>{errors.surname}</Text>
            )}
            <TextInput
              value={values.email}
              onChangeText={(value) => updateField("email", value)}
              onBlur={() => validateField("email")}
              placeholder="Email"
              placeholderTextColor={colors.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            {!!errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
            <TextInput
              value={values.password}
              onChangeText={(value) => updateField("password", value)}
              onBlur={() => validateField("password")}
              placeholder="Password"
              placeholderTextColor={colors.gray400}
              secureTextEntry
              style={styles.input}
            />
            <Text style={styles.passwordHint}>
              8+ characters, one capital, one number and one special character
            </Text>
            {!!errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          <View style={styles.bottom}>
            <Text style={styles.hint}>drag to agree to terms & Conditions</Text>
            <Text style={styles.termsStatus}>
              {values.termsAccepted ? "terms accepted" : "terms not accepted"}
            </Text>
            <View style={styles.track}>
              <View style={styles.trackDashed} />
              <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.knob, knobStyle]}>
                  <ChevronRight color={colors.white} size={20} />
                </Animated.View>
              </GestureDetector>
            </View>
            {!!errors.termsAccepted && (
              <Text style={styles.errorText}>{errors.termsAccepted}</Text>
            )}
            {!!errors.form && (
              <Text style={styles.errorText}>{errors.form}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    padding: 32,
    justifyContent: "center",
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.white,
    marginBottom: 32,
  },
  backLink: {
    color: colors.gray400,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 28,
  },
  intro: {
    color: colors.white50,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 340,
  },
  socialButtons: {
    gap: 10,
    marginBottom: 30,
  },
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
  socialButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  fields: {
    gap: 24,
  },
  input: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.white20,
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
  termsStatus: {
    color: colors.white50,
    fontSize: 11,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  errorText: {
    color: colors.rose,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -16,
  },
  passwordHint: {
    color: colors.white50,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -12,
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
