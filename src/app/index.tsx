import * as Haptics from "expo-haptics";
import OnboardingOne from "../screens/OnboardingOne";
import OnboardingTwo from "../screens/OnboardingTwo"; // adjust the path if necessary
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Screen =
  | "SPLASH"
  | "FORK"
  | "LOGIN"
  | "SIGNUP"
  | "ONBOARDING"
  | "DASHBOARD"
  | "PROFILE"
  | "FOCUS"
  | "BREATHE"
  | "OUTDOORS";
type Accent = "#e11d48" | "#f97316" | "#16a34a" | "#3b82f6";
const colors = {
  black: "#0a0a0a",
  paper: "#f5f5f5",
  white: "#fff",
  line: "#242424",
};

export default function Index() {
  const [screen, setScreen] = useState<Screen>("SPLASH");
  const [name, setName] = useState("Jane Doe");
  const go = (next: Screen) => {
    Haptics.selectionAsync().catch(() => undefined);
    setScreen(next);
  };
  useEffect(() => {
    const timer = setTimeout(() => setScreen("FORK"), 4000);
    return () => clearTimeout(timer);
  }, []);
  if (screen === "SPLASH") return <Splash />;
  if (screen === "FORK")
    return <Fork onLogin={() => go("LOGIN")} onSignup={() => go("SIGNUP")} />;
  if (screen === "LOGIN")
    return (
      <Auth
        title="return."
        button="jump to dashboard"
        onComplete={() => go("DASHBOARD")}
      />
    );
  if (screen === "SIGNUP")
    return (
      <Auth
        title="begin."
        button="create your state"
        signup
        onComplete={() => go("ONBOARDING")}
      />
    );
   if (screen === "ONBOARDING")
  return <OnboardingOne onComplete={() => go("RITUAL")} />;
if (screen === "RITUAL")
  return <OnboardingTwo onComplete={() => go("DASHBOARD")} />;
  if (screen === "PROFILE")
    return (
      <Profile
        name={name}
        setName={setName}
        onBack={() => go("DASHBOARD")}
        onLogout={() => go("SPLASH")}
      />
    );
  if (screen === "FOCUS") return <Focus onBack={() => go("DASHBOARD")} />;
  if (screen === "BREATHE") return <Breathe onBack={() => go("DASHBOARD")} />;
  if (screen === "OUTDOORS") return <Outdoors onBack={() => go("DASHBOARD")} />;
  return (
    <Dashboard
      onProfile={() => go("PROFILE")}
      onFocus={() => go("FOCUS")}
      onBreathe={() => go("BREATHE")}
      onOutdoors={() => go("OUTDOORS")}
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
      <Animated.Text entering={FadeIn.duration(900)} style={styles.logo}>
        kenetic.
      </Animated.Text>
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
}: {
  title: string;
  button: string;
  signup?: boolean;
  onComplete: () => void;
}) {
  const [agreed, setAgreed] = useState(!signup);
  return (
    <ScreenFrame light>
      <ScrollView
        contentContainerStyle={styles.auth}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lightTitle}>{title}</Text>
        {signup && (
          <View style={styles.inputGroup}>
            <Input placeholder="name" />
            <Input placeholder="surname" />
          </View>
        )}
        <View style={styles.inputGroup}>
          <Input placeholder="email" keyboardType="email-address" />
          <Input placeholder="password" secureTextEntry />
        </View>
        {signup && (
          <Pressable
            onPress={() => setAgreed((value) => !value)}
            style={styles.terms}
          >
            <View style={[styles.check, agreed && styles.checkActive]} />
            <Text style={styles.termsText}>
              I agree to the boundaries of kenetic.
            </Text>
          </Pressable>
        )}
        <Text style={styles.social}>apple. google. facebook.</Text>
        <Pressable
          disabled={!agreed}
          onPress={onComplete}
          style={({ pressed }) => [
            styles.textAction,
            !agreed && { opacity: 0.3 },
            pressed && { opacity: 0.55 },
          ]}
        >
          <Text style={styles.actionText}>{button} ›</Text>
        </Pressable>
      </ScrollView>
    </ScreenFrame>
  );
}
function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput {...props} placeholderTextColor="#aaa" style={styles.input} />
  );
}
function Dashboard({
  onProfile,
  onFocus,
  onBreathe,
  onOutdoors,
}: {
  onProfile: () => void;
  onFocus: () => void;
  onBreathe: () => void;
  onOutdoors: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const select = (id: string, action: () => void) => {
    setSelected(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setTimeout(() => {
      setSelected(null);
      action();
    }, 850);
  };
  return (
    <ScreenFrame>
      <View style={styles.dashboard}>
        <View>
          <Text style={styles.eyebrow}>kenetic / command center</Text>
          <Text style={styles.heading}>drag state into{`\n`}aura.</Text>
          <Text style={styles.subtle}>
            choose a practice to shift the way you meet the day.
          </Text>
        </View>
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
        <Pressable onPress={onProfile} style={styles.profileLink}>
          <Text style={styles.profileText}>← your profile.</Text>
        </Pressable>
      </View>
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
function Focus({ onBack }: { onBack: () => void }) {
  return (
    <FeatureList
      title="focus state."
      accent="#e11d48"
      onBack={onBack}
      items={[
        {
          title: "get shit done.",
          description:
            "Connect your attention to a sound tether and protect a deep work session.",
        },
        {
          title: "alien mode.",
          description:
            "Turn an overwhelming task into one physical first action.",
        },
      ]}
    />
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
  lightTitle: {
    color: "#111",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  inputGroup: { gap: 18 },
  input: {
    color: "#111",
    fontSize: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingVertical: 10,
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
