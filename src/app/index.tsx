import {
  getNotificationPreference,
  loadFocusDashboardMetrics,
  persistDashboardSelection,
  persistFocusFeatureLaunch,
  persistNotificationPreference,
  persistOnboardingCompletion,
  registerUserAccount,
  restoreSignedInAccount,
  syncNotificationDevice,
} from "@/lib/firebase/bootstrap";
import AlienModeScreen from "@/screens/AlienModeScreen";
import BreatheDashboard from "@/screens/BreatheDashboard";
import DashboardScreen from "@/screens/Dashboard";
import GsdSetupScreen from "@/screens/GsdSetupScreen";
import IntakeCarousel from "@/screens/IntakeCarousel";
import LoginScreen from "@/screens/LoginScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import OutdoorsDashboard from "@/screens/OutdoorsDashboard";
import ProfileScreen from "@/screens/ProfileScreen";
import SignupScreen from "@/screens/SignupScreen";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type Screen =
  | "SPLASH"
  | "FORK"
  | "LOGIN"
  | "SIGNUP"
  | "CAROUSEL"
  | "ONBOARDING"
  | "RITUAL"
  | "DASHBOARD"
  | "PROFILE"
  | "FOCUS"
  | "GSD_SETUP"
  | "ALIEN_MODE"
  | "BREATHE"
  | "BREATHE_SETUP"
  | "OUTDOORS"
  | "OUTDOORS_FEATURE";
type Accent = "#e11d48" | "#f97316" | "#16a34a" | "#3b82f6";
const colors = {
  black: "#0a0a0a",
  paper: "#f5f5f5",
  white: "#fff",
  line: "#242424",
};

const triggerImpact = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => undefined);
};

const triggerNotification = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => undefined);
};

export default function Index() {
  const [screen, setScreen] = useState<Screen>("SPLASH");
  const [name, setName] = useState("Jane Doe");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const restoredAccount = useRef(false);
  const go = (next: Screen) => {
    Haptics.selectionAsync().catch(() => undefined);
    setScreen(next);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!restoredAccount.current) setScreen("FORK");
    }, 4000);
    void restoreSignedInAccount()
      .then((user) => {
        if (user) {
          restoredAccount.current = true;
          clearTimeout(timer);
          setScreen("DASHBOARD");
        }
      })
      .catch(() => undefined);
    return () => clearTimeout(timer);
  }, []);
  if (screen === "SPLASH") return <Splash />;
  if (screen === "FORK")
    return <Fork onLogin={() => go("LOGIN")} onSignup={() => go("SIGNUP")} />;
  if (screen === "LOGIN")
    return (
      <LoginScreen
        onComplete={() => {
          setShowNotificationPrompt(false);
          go("DASHBOARD");
        }}
        onBack={() => go("FORK")}
      />
    );
  if (screen === "SIGNUP")
    return (
      <SignupScreen
        onComplete={() => go("CAROUSEL")}
        onSubmit={async (values) => {
          await registerUserAccount(values);
          go("CAROUSEL");
        }}
        onBack={() => go("FORK")}
      />
    );

  if (screen === "CAROUSEL")
    return <IntakeCarousel onComplete={() => go("ONBOARDING")} />;

  if (screen === "ONBOARDING")
    return (
      <ScreenFrame>
        <OnboardingScreen
          onComplete={() => {
            void persistOnboardingCompletion().catch(() => undefined);
            setShowNotificationPrompt(true);
            go("DASHBOARD");
          }}
        />
      </ScreenFrame>
    );

  if (screen === "PROFILE")
    return (
      <ProfileScreen
        onBack={() => go("DASHBOARD")}
        onLogout={() => go("LOGIN")}
      />
    );
  if (screen === "FOCUS")
    return (
      <Focus
        onBack={() => go("DASHBOARD")}
        onGetShitDone={() => go("GSD_SETUP")}
        onAlienMode={() => go("ALIEN_MODE")}
      />
    );
  if (screen === "GSD_SETUP")
    return <GsdSetupScreen onBack={() => go("FOCUS")} />;
  if (screen === "ALIEN_MODE")
    return <AlienModeScreen onBack={() => go("FOCUS")} />;
  if (screen === "BREATHE")
    return (
      <BreatheDashboard
        onBack={() => go("DASHBOARD")}
        onCalm={() => go("BREATHE_SETUP")}
        onRecenter={() => go("BREATHE_SETUP")}
        onClearMind={() => go("BREATHE_SETUP")}
        onDeepRelax={() => go("BREATHE_SETUP")}
      />
    );
  if (screen === "BREATHE_SETUP")
    return (
      <FeatureList
        title="breathe practice."
        accent="#f97316"
        onBack={() => go("BREATHE")}
        items={[
          {
            title: "guided breath",
            description: "Your breathe feature will open here.",
          },
        ]}
      />
    );
  if (screen === "OUTDOORS")
    return (
      <OutdoorsDashboard
        onBack={() => go("DASHBOARD")}
        onBioRadar={() => go("OUTDOORS_FEATURE")}
        onCuriosity={() => go("OUTDOORS_FEATURE")}
        onSpotFinder={() => go("OUTDOORS_FEATURE")}
        onChallenges={() => go("OUTDOORS_FEATURE")}
      />
    );
  if (screen === "OUTDOORS_FEATURE")
    return (
      <FeatureList
        title="outdoors feature."
        accent="#16a34a"
        onBack={() => go("OUTDOORS")}
        items={[
          {
            title: "field practice",
            description: "Your outdoor feature will open here.",
          },
        ]}
      />
    );
  return (
    <DashboardScreen
      onProfile={() => go("PROFILE")}
      onFocus={() => go("FOCUS")}
      onBreathe={() => go("BREATHE")}
      onOutdoors={() => go("OUTDOORS")}
      showNotificationPrompt={showNotificationPrompt}
    />
  );
}

function ScreenFrame({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: light ? colors.paper : colors.black },
      ]}
    >
      <Animated.View
        entering={FadeIn.duration(520)}
        exiting={FadeOut.duration(260)}
        style={styles.screenContent}
      >
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}
function Splash() {
  const breath = useSharedValue(1);
  const release = useSharedValue(1);
  const opacity = useSharedValue(1);
  const taglineOpacity = useSharedValue(0);
  const shape = useSharedValue(0);
  const fluidColor = useSharedValue("#16a34a");
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1.18, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    release.value = withDelay(
      2900,
      withTiming(5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    );
    shape.value = withSequence(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      withTiming(2, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      withTiming(3, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    );
    fluidColor.value = withSequence(
      withTiming("#16a34a", {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      withTiming("#e11d48", {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      withTiming("#f97316", {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
    );
    opacity.value = withDelay(
      3500,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }),
    );
    taglineOpacity.value = withDelay(3000, withTiming(1, { duration: 900 }));
  }, [breath, fluidColor, opacity, release, shape]);
  const fluidStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: fluidColor.value,
    borderRadius:
      shape.value === 0
        ? 150
        : shape.value === 1
          ? 105
          : shape.value === 2
            ? 175
            : 150,
    transform: [
      { scale: breath.value * release.value },
      { rotate: `${(breath.value - 1) * 18}deg` },
    ],
  }));
  return (
    <View style={styles.centerScreen}>
      <Animated.View
        style={[
          styles.splashFluid,
          Platform.OS === "web" && styles.splashWebBlur,
          fluidStyle,
        ]}
      />
      <View style={styles.logoGroup}>
        <Animated.Text entering={FadeIn.duration(900)} style={styles.logo}>
          kenetic.
        </Animated.Text>
        <Animated.Text
          style={[styles.tagline, { opacity: taglineOpacity.value }]}
        >
          we inspire movement.
        </Animated.Text>
      </View>
    </View>
  );
}
function Fork({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <ScreenFrame>
      <View style={styles.fork}>
        <ForkChoice
          label="return."
          hint="tap to sign in"
          color="#16a34a"
          onPress={onLogin}
        />
        <View style={styles.divider} />
        <ForkChoice
          label="begin."
          hint="tap to create account"
          color="#f97316"
          onPress={onSignup}
        />
      </View>
    </ScreenFrame>
  );
}
function ForkChoice({
  label,
  hint,
  color,
  onPress,
}: {
  label: string;
  hint: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.forkChoice, pressed && { opacity: 0.55 }]}
    >
      <Text style={[styles.forkTitle, { color }]}>{label}</Text>
      <Text style={styles.eyebrow}>{hint}</Text>
    </Pressable>
  );
}
function Auth({
  title,
  button,
  signup = false,
  onComplete,
  onBack,
}: {
  title: string;
  button: string;
  signup?: boolean;
  onComplete: () => void;
  onBack?: () => void;
}) {
  const [agreed, setAgreed] = useState(!signup);
  const backX = useSharedValue(0);
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
    <ScreenFrame light={!signup}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.authKeyboard}
      >
        <ScrollView
          contentContainerStyle={styles.auth}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.lightTitle, signup && styles.darkAuthTitle]}>
            {title}
          </Text>
          {signup && (
            <Text style={[styles.authIntro, styles.darkAuthMuted]}>
              Find curiosity in everyday life, stay centered in the moment, and
              move forward with renewed attention.
            </Text>
          )}
          {signup && (
            <View style={styles.inputGroup}>
              <Input placeholder="name" dark />
              <Input placeholder="surname" dark />
            </View>
          )}
          <View style={styles.inputGroup}>
            <Input
              placeholder="email"
              keyboardType="email-address"
              dark={signup}
            />
            <Input placeholder="password" secureTextEntry dark={signup} />
          </View>
          {signup && (
            <Pressable
              onPress={() => setAgreed((value) => !value)}
              style={styles.terms}
            >
              <View style={[styles.check, agreed && styles.checkActive]} />
              <Text style={[styles.termsText, signup && styles.darkAuthMuted]}>
                I agree to the boundaries of kenetic.
              </Text>
            </Pressable>
          )}
          <Text style={[styles.social, signup && styles.darkAuthMuted]}>
            apple. google. facebook.
          </Text>
          <Pressable
            disabled={!agreed}
            onPress={onComplete}
            style={({ pressed }) => [
              styles.textAction,
              !agreed && { opacity: 0.3 },
              pressed && { opacity: 0.55 },
            ]}
          >
            <Text style={[styles.actionText, signup && styles.darkAuthAction]}>
              {button} ›
            </Text>
          </Pressable>
          {onBack && (
            <GestureDetector gesture={backGesture}>
              <Animated.Text style={[styles.authBackLink, backStyle]}>
                where to? →
              </Animated.Text>
            </GestureDetector>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}
function Input({
  dark = false,
  ...props
}: React.ComponentProps<typeof TextInput> & { dark?: boolean }) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={dark ? "#999" : "#aaa"}
      style={[styles.input, dark && styles.darkInput]}
    />
  );
}
function Dashboard({
  onProfile,
  onFocus,
  onBreathe,
  onOutdoors,
  showNotificationPrompt = true,
}: {
  onProfile: () => void;
  onFocus: () => void;
  onBreathe: () => void;
  onOutdoors: () => void;
  showNotificationPrompt?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [showBoundary, setShowBoundary] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const boundaryOpacity = useSharedValue(1);

  useEffect(() => {
    let mounted = true;
    void getNotificationPreference()
      .then((preference) => {
        if (!mounted) return;
        setShowBoundary(showNotificationPrompt && preference === undefined);
        if (preference === "sure") void syncNotificationDevice();
      })
      .catch(() => {
        if (mounted) setShowBoundary(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const dismissBoundary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    boundaryOpacity.value = withTiming(0, { duration: 320 });
    setTimeout(() => setShowBoundary(false), 320);
  };

  const chooseNotificationPreference = async (choice: "later" | "sure") => {
    if (savingPreference) return;
    setSavingPreference(true);
    try {
      await persistNotificationPreference(choice);
      dismissBoundary();
    } catch {
      setSavingPreference(false);
    }
  };

  const boundaryOverlayStyle = useAnimatedStyle(() => ({
    opacity: boundaryOpacity.value,
  }));

  const select = async (id: string, action: () => void) => {
    setSelected(id);
    setSelectionError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    try {
      await persistDashboardSelection(
        id.replace(".", "") as "focus" | "outdoors" | "breathe",
      );
      setTimeout(() => {
        setSelected(null);
        action();
      }, 850);
    } catch {
      setSelected(null);
      setSelectionError("Could not save your state. Try again.");
    }
  };
  const profileX = useSharedValue(0);
  const profileGesture = Gesture.Pan()
    .enabled(!selected && !showBoundary)
    .onUpdate((event) => {
      profileX.value =
        event.translationX > 0 ? event.translationX : event.translationX * 0.1;
    })
    .onEnd((event) => {
      if (event.translationX > 60) {
        runOnJS(triggerImpact)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onProfile)();
      } else {
        profileX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });
  const profileStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: profileX.value }],
  }));
  return (
    <ScreenFrame>
      <View
        style={styles.dashboard}
        pointerEvents={showBoundary ? "none" : "auto"}
      >
        <View>
          <Text style={styles.eyebrow}>kenetic / command center</Text>
          <Text style={styles.heading}>drag state into{`\n`}aura.</Text>
          <Text style={styles.subtle}>
            choose a practice to shift the way you meet the day.
          </Text>
        </View>
        {selectionError && (
          <Text style={styles.selectionError}>{selectionError}</Text>
        )}
        <View style={styles.aura}>
          <LinearGradient
            colors={["#e11d48", "#f97316", "#16a34a"]}
            style={styles.auraGradient}
          />
          <View style={styles.auraCore} />
          <Text style={styles.auraText}>your{`\n`}aura</Text>
        </View>
        <View style={styles.menu}>
          {[
            ["focus.", "#e11d48", onFocus],
            ["outdoors.", "#16a34a", onOutdoors],
            ["breathe.", "#f97316", onBreathe],
          ].map(([label, color, action]) => (
            <DashboardItem
              key={String(label)}
              label={String(label)}
              color={String(color)}
              disabled={selected !== null}
              onDrop={() => select(String(label), action as () => void)}
            />
          ))}
        </View>
        <GestureDetector gesture={profileGesture}>
          <Animated.View style={styles.profileLink}>
            <Animated.Text style={[styles.profileText, profileStyle]}>
              your profile. →
            </Animated.Text>
          </Animated.View>
        </GestureDetector>
      </View>
      {showBoundary && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, boundaryOverlayStyle]}
        >
          <BlurView
            intensity={42}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View
            entering={SlideInDown.duration(520)}
            exiting={SlideOutDown.duration(320)}
            style={styles.boundaryCard}
          >
            <Text style={styles.boundaryTitle}>allow{"\n"}boundaries?</Text>
            <Text style={styles.boundaryText}>
              Are there any digital boundaries or physical tasks you need to
              clear before immersing yourself?
            </Text>
            <View style={styles.boundaryActions}>
              <Pressable
                onPress={() => void chooseNotificationPreference("sure")}
                style={styles.boundaryButton}
              >
                <Text style={styles.boundaryButtonText}>i am clear →</Text>
              </Pressable>
              <Pressable
                onPress={() => void chooseNotificationPreference("later")}
              >
                <Text style={styles.boundaryNotNow}>not now</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </ScreenFrame>
  );
}

function DashboardItem({
  label,
  color,
  onDrop,
  disabled,
}: {
  label: string;
  color: string;
  onDrop: () => void;
  disabled: boolean;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const active = useSharedValue(false);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      active.value = true;
      runOnJS(Haptics.selectionAsync)();
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
    })
    .onEnd(() => {
      const landed = x.value > 90 && y.value < -100;
      if (landed) runOnJS(onDrop)();
      x.value = withTiming(0, { duration: 420 });
      y.value = withTiming(0, { duration: 420 });
      active.value = false;
    });
  const itemStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: active.value ? 1.06 : 1 },
    ],
    opacity: active.value ? 0.9 : 1,
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.menuItem, itemStyle]}>
        <Text style={[styles.menuLabel, { color }]}>{label}</Text>
        <Text style={styles.chevron}>›</Text>
      </Animated.View>
    </GestureDetector>
  );
}
function Profile({
  name,
  setName,
  onBack,
  onLogout,
}: {
  name: string;
  setName: (value: string) => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sections = {
    privacy: "Your data is encrypted. We do not sell physiological metrics.",
    terms: "Respect your own boundaries. Do not use while driving.",
    support: "Reach out to terminal@kenetic.app for assistance.",
  };
  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.profile}>
        <Text style={styles.eyebrow}>your profile</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>
        </View>
        {editing ? (
          <Input value={name} onChangeText={setName} autoFocus />
        ) : (
          <Text style={styles.heading}>{name.toLowerCase()}.</Text>
        )}
        <Text style={styles.subtle}>joined 24 august 2026</Text>
        <Pressable onPress={() => setEditing((value) => !value)}>
          <Text style={styles.edit}>
            {editing ? "done." : "drag to edit →"}
          </Text>
        </Pressable>
        <View style={styles.ledger}>
          {Object.entries(sections).map(([key, value]) => (
            <View key={key} style={styles.ledgerRow}>
              <Pressable
                onPress={() => setExpanded(expanded === key ? null : key)}
              >
                <Text style={styles.sectionTitle}>{key}.</Text>
              </Pressable>
              {expanded === key && <Text style={styles.subtle}>{value}</Text>}
            </View>
          ))}
        </View>
        <View style={styles.bottomRow}>
          <Pressable onPress={onBack}>
            <Text style={styles.profileText}>→ dashboard.</Text>
          </Pressable>
          <Pressable onPress={onLogout}>
            <Text style={[styles.profileText, { color: "#e11d48" }]}>
              logout.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}
function FeatureList({
  title,
  accent,
  items,
  onBack,
}: {
  title: string;
  accent: Accent;
  items: { title: string; description: string }[];
  onBack: () => void;
}) {
  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.featureScreen}>
        <Pressable onPress={onBack}>
          <Text style={styles.eyebrow}>← dashboard</Text>
        </Pressable>
        <Text style={[styles.heading, { color: accent }]}>{title}</Text>
        <Text style={styles.subtle}>
          move one practice into the center to begin.
        </Text>
        {items.map((item) => (
          <Pressable
            key={item.title}
            onPress={() =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            }
            style={({ pressed }) => [
              styles.feature,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={[styles.eyebrow, { color: accent }]}>
              {item.title === "get shit done."
                ? "sound tether & app lock"
                : "guided practice"}
            </Text>
            <Text style={styles.subtle}>{item.description}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}
function Focus({
  onBack,
  onGetShitDone,
  onAlienMode,
}: {
  onBack: () => void;
  onGetShitDone: () => void;
  onAlienMode: () => void;
}) {
  const [focusMetrics, setFocusMetrics] = useState({
    completedSessions: 0,
    getShitDoneSessions: 0,
    alienModeSessions: 0,
    handoffCompletedSessions: 0,
    getShitDoneMinutes: 0,
    alienModeMinutes: 0,
    totalFocusMinutes: 0,
  });
  const [focusLaunchError, setFocusLaunchError] = useState<string | null>(null);
  const auraScale = useSharedValue(1);
  const auraMorph = useSharedValue(0);
  const auraExpand = useSharedValue(0);
  const exitTranslateX = useSharedValue(0);

  useEffect(() => {
    void loadFocusDashboardMetrics()
      .then(setFocusMetrics)
      .catch(() => undefined);
    auraScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    auraMorph.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const exitGesture = Gesture.Pan()
    .activeOffsetX(10)
    .onUpdate((event) => {
      if (event.translationX > 0) exitTranslateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > 80) {
        runOnJS(onBack)();
      } else {
        exitTranslateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const auraStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: auraScale.value + auraExpand.value * 0.45 },
      { translateX: interpolate(auraMorph.value, [-1, 1], [-30, 20]) },
      { translateY: interpolate(auraMorph.value, [-1, 1], [-20, 25]) },
      { scaleX: interpolate(auraMorph.value, [-1, 1], [0.94, 1.15]) },
      { scaleY: interpolate(auraMorph.value, [-1, 1], [1.12, 0.9]) },
    ],
    opacity: interpolate(auraExpand.value, [0, 1, 2], [0.7, 0.9, 1]),
  }));

  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: exitTranslateX.value }],
  }));

  const launchFocusFeature = async (
    feature: "get-shit-done" | "alien-mode",
    action: () => void,
  ) => {
    setFocusLaunchError(null);
    try {
      await persistFocusFeatureLaunch(feature);
      action();
    } catch {
      setFocusLaunchError("Could not save this focus choice. Try again.");
    }
  };

  return (
    <ScreenFrame>
      <Animated.View
        style={[styles.focusScreen, screenStyle]}
        entering={FadeIn.duration(500)}
      >
        <Animated.View style={[styles.focusAura, auraStyle]}>
          <LinearGradient
            colors={["#b3133b", "#e11d48", "rgba(225,29,72,0)"]}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <BlurView
            intensity={70}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <ScrollView contentContainerStyle={styles.focusContent}>
          <GestureDetector gesture={exitGesture}>
            <View style={styles.focusTopNav}>
              <Text style={styles.focusBackLabel}>← dashboard </Text>
              <Text style={styles.focusBackHint}>
                (drag right to exit focus state)
              </Text>
            </View>
          </GestureDetector>
          <Text style={styles.focusTitle}>focus state.</Text>
          <View style={styles.focusMetrics}>
            <FocusMetric
              value={`${focusMetrics.completedSessions}`}
              label="completed sessions"
            />
            <FocusMetric
              value={`${focusMetrics.totalFocusMinutes}m`}
              label="focus time completed"
            />
            <FocusMetric
              value={`${focusMetrics.getShitDoneSessions}`}
              label="get shit done sessions"
            />
            <FocusMetric
              value={`${focusMetrics.alienModeSessions}`}
              label="alien mode sessions"
            />
            <FocusMetric
              value={`${focusMetrics.alienModeMinutes}m`}
              label="alien mode time completed"
            />
            <FocusMetric
              value={`${focusMetrics.handoffCompletedSessions}`}
              label="two-minute handoffs completed"
            />
          </View>
          {focusLaunchError && (
            <Text style={styles.focusLaunchError}>{focusLaunchError}</Text>
          )}
          <View style={styles.focusGateways}>
            <FocusGateway
              title="get shit done."
              label="sound tether & app lock"
              description="Connects Apple Music or Spotify. Activates background audio and automatically pauses playback if you stay actively on your phone for more than 2 minutes."
              auraExpand={auraExpand}
              onLaunch={() =>
                void launchFocusFeature("get-shit-done", onGetShitDone)
              }
            />
            <FocusGateway
              title="alien mode."
              label="ai task deconstructor"
              description={
                'Intercepts overwhelming tasks and prompts you with a "Beginner\'s Mind" question to reframe your perspective before the timer begins.'
              }
              auraExpand={auraExpand}
              onLaunch={() =>
                void launchFocusFeature("alien-mode", onAlienMode)
              }
            />
          </View>
        </ScrollView>
      </Animated.View>
    </ScreenFrame>
  );
}

function FocusMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.focusMetric}>
      <Text style={styles.focusMetricValue}>{value}</Text>
      <Text style={styles.focusMetricLabel}>{label}</Text>
    </View>
  );
}

function FocusGateway({
  title,
  label,
  description,
  auraExpand,
  onLaunch,
}: {
  title: string;
  label: string;
  description: string;
  auraExpand: SharedValue<number>;
  onLaunch: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isGrabbed = useSharedValue(false);
  const gesture = Gesture.Pan()
    .onStart(() => {
      isGrabbed.value = true;
      runOnJS(triggerImpact)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX);
      translateY.value = Math.min(0, event.translationY);
      auraExpand.value = withTiming(
        Math.min(1.2, Math.max(0, -event.translationY / 200)),
        { duration: 100 },
      );
    })
    .onEnd((event) => {
      isGrabbed.value = false;
      if (event.translationX < -80) {
        auraExpand.value = withTiming(2.5, { duration: 350 });
        runOnJS(triggerNotification)(Haptics.NotificationFeedbackType.Success);
        runOnJS(onLaunch)();
      } else {
        auraExpand.value = withTiming(0, { duration: 300 });
      }
      translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: isGrabbed.value ? 1.03 : 1 },
    ],
    opacity: isGrabbed.value ? 0.88 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.focusGatewayCard, style]}>
        <Text style={styles.focusGatewayTitle}>{title}</Text>
        <Text style={styles.focusGatewayLabel}>{label}</Text>
        <Text style={styles.focusGatewayDescription}>{description}</Text>
        <Text style={styles.focusGatewayHint}>← swipe left to open</Text>
      </Animated.View>
    </GestureDetector>
  );
}
function Breathe({ onBack }: { onBack: () => void }) {
  return (
    <FeatureList
      title="breathe state."
      accent="#f97316"
      onBack={onBack}
      items={[
        {
          title: "calm down.",
          description:
            "Physiological sigh for acute anxiety and physical tension.",
        },
        {
          title: "recenter.",
          description: "Rhythmic grounding for distraction and task switching.",
        },
        {
          title: "clear mind.",
          description: "Box breathing for overload and pre-focus preparation.",
        },
        {
          title: "deep relax.",
          description: "A slow body scan for shutdown and recovery.",
        },
      ]}
    />
  );
}
function Outdoors({ onBack }: { onBack: () => void }) {
  return (
    <FeatureList
      title="outdoors state."
      accent="#16a34a"
      onBack={onBack}
      items={[
        {
          title: "bio radar ai.",
          description:
            "Scan a plant, animal, or sound and turn it into a field dossier.",
        },
        {
          title: "curiosity quizzes.",
          description: "Recall what you discovered outside.",
        },
        {
          title: "spot finder.",
          description: "Find trails, waters, and sanctuaries nearby.",
        },
        {
          title: "daily challenges.",
          description: "Practice perceptive grounding in the ordinary world.",
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    alignSelf: "center",
    backgroundColor: colors.black,
    ...(Platform.OS === "web"
      ? {
          maxHeight: 932,
          borderWidth: 8,
          borderColor: "#1a1a1a",
          borderRadius: 48,
          overflow: "hidden",
        }
      : {}),
  },
  screenContent: { flex: 1 },
  centerScreen: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  splashFluid: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.9,
    shadowColor: "#e11d48",
    shadowOpacity: 0.55,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 0 },
  },
  splashWebBlur: {
    ...(Platform.OS === "web" ? { filter: "blur(28px)" } : {}),
  } as object,
  logo: {
    color: colors.white,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
  },
  logoGroup: {
    alignItems: "center",
    zIndex: 10,
  },
  tagline: {
    marginTop: 8,
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  fork: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  forkChoice: { flex: 1, alignItems: "center", paddingVertical: 40 },
  divider: { width: 1, height: "65%", backgroundColor: colors.line },
  forkTitle: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  eyebrow: {
    color: "#777",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  auth: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 28 },
  authKeyboard: { flex: 1 },
  lightTitle: {
    color: "#111",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  darkAuthTitle: { color: colors.white },
  darkAuthMuted: { color: "rgba(255,255,255,0.5)" },
  darkAuthAction: { color: colors.white },
  authBackLink: {
    color: "#777",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 24,
  },
  authIntro: {
    color: "#777",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
  inputGroup: { gap: 18 },
  input: {
    color: "#111",
    fontSize: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingVertical: 10,
  },
  darkInput: {
    color: colors.white,
    borderBottomColor: "#3a3a3a",
  },
  terms: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 20, height: 20, borderWidth: 1, borderColor: "#aaa" },
  checkActive: { backgroundColor: "#111" },
  termsText: { color: "#777", fontSize: 13 },
  social: { color: "#999", fontWeight: "700" },
  textAction: { marginTop: 16 },
  actionText: { color: "#111", fontSize: 20, fontWeight: "800" },
  dashboard: { flex: 1, padding: 28, paddingTop: 38 },
  heading: {
    color: colors.white,
    fontSize: 48,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -2,
    marginTop: 22,
  },
  subtle: { color: "#858585", fontSize: 14, lineHeight: 21, marginTop: 12 },
  selectionError: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  aura: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#e11d48",
    opacity: 0.48,
    alignItems: "center",
    justifyContent: "center",
  },
  auraGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 165,
    opacity: 0.9,
  },
  auraCore: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#f97316",
    opacity: 0.8,
  },
  auraText: {
    position: "absolute",
    color: colors.white,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 18,
  },
  menu: { marginTop: 56, gap: 18 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 14,
  },
  menuLabel: { fontSize: 42, fontWeight: "900", letterSpacing: -2 },
  chevron: { color: "#666", fontSize: 32 },
  profileLink: { position: "absolute", bottom: 30, left: 28 },
  profileText: { color: "#aaa", fontSize: 17, fontWeight: "600" },
  boundaryCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f5f5f5",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingTop: 58,
    paddingBottom: 42,
  },
  boundaryTitle: {
    color: "#111",
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  boundaryText: {
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 18,
    maxWidth: 340,
  },
  boundaryActions: {
    alignItems: "flex-end",
    gap: 12,
    marginTop: 28,
  },
  boundaryButton: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  boundaryButtonText: { color: colors.white, fontWeight: "800" },
  boundaryNotNow: { color: "#888", fontWeight: "700", padding: 8 },
  profile: { flexGrow: 1, padding: 28, paddingTop: 38 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#e11d48",
    marginTop: 42,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 56, fontWeight: "900" },
  edit: { color: colors.white, marginTop: 18, fontWeight: "700" },
  ledger: { marginTop: 70, gap: 24, alignItems: "flex-end" },
  ledgerRow: { width: "80%", gap: 8, alignItems: "flex-end" },
  sectionTitle: { color: "#ddd", fontSize: 25, fontWeight: "700" },
  bottomRow: {
    marginTop: "auto",
    paddingTop: 60,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  featureScreen: { flexGrow: 1, padding: 28, paddingTop: 38 },
  feature: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 28,
    gap: 5,
  },
  focusScreen: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: "hidden",
  },
  focusAura: {
    position: "absolute",
    top: -150,
    left: -90,
    width: 430,
    height: 420,
    borderRadius: 220,
    backgroundColor: "#e11d48",
    overflow: "hidden",
    shadowColor: "#e11d48",
    shadowOpacity: 0.55,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  focusTopNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 24,
    transform: [{ translateY: 60 }],
  },
  focusBackLabel: {
    color: "#e11d48",
    fontSize: 15,
    fontWeight: "700",
  },
  focusBackHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    fontWeight: "500",
  },
  focusContent: {
    padding: 32,
    paddingTop: 112,
    paddingBottom: 48,
  },
  focusTitle: {
    color: colors.white,
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 36,
  },
  focusMetrics: {
    gap: 18,
    marginBottom: 64,
  },
  focusLaunchError: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  focusMetric: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 14,
  },
  focusMetricValue: {
    color: colors.white,
    minWidth: 94,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -2,
  },
  focusMetricLabel: {
    color: "#858585",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  focusGateways: {
    marginTop: 68,
    gap: 42,
  },
  focusGatewayCard: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 24,
  },
  focusGatewayTitle: {
    color: colors.white,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  focusGatewayLabel: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  focusGatewayDescription: {
    color: "#777",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
  },
  focusGatewayHint: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 18,
    textTransform: "uppercase",
  },
  featureTitle: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
  },
  wipe: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#e11d48",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  wipeText: {
    color: colors.white,
    fontSize: 54,
    fontWeight: "900",
    letterSpacing: -2,
  },
});
