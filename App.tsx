import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  persistOnboardingCompletion,
  registerUserAccount,
  restoreSignedInAccount,
} from "./src/lib/firebase/bootstrap";
import AlienModeScreen from "./src/screens/AlienModeScreen";
import BreatheDashboard from "./src/screens/BreatheDashboard";
import BreatheExerciseScreen from "./src/screens/BreatheExerciseScreen";
import Dashboard from "./src/screens/Dashboard";
import FocusDashboard from "./src/screens/FocusDashboard";
import GsdSetupScreen from "./src/screens/GsdSetupScreen";
import IntakeCarousel from "./src/screens/IntakeCarousel";
import LoginScreen from "./src/screens/LoginScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import OutdoorsDashboard from "./src/screens/OutdoorsDashboard";
import ProfileScreen from "./src/screens/ProfileScreen";
import SignupScreen from "./src/screens/SignupScreen";
import SplashScreen from "./src/screens/SplashScreen";
import TheFork from "./src/screens/TheFork";
import { colors } from "./src/theme/colors";
import { ScreenState } from "./src/types";

// Screens below are not yet ported in this phase — placeholder keeps
// the navigation graph intact and the app runnable end to end.
function ComingSoon({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonTitle}>{label}</Text>
      <Text style={styles.comingSoonSub}>
        not ported yet — next build phase
      </Text>
      <Pressable onPress={onBack} style={{ marginTop: 32 }}>
        <Text style={styles.comingSoonBack}>&larr; back to dashboard</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>("SPLASH");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const restoredAccount = React.useRef(false);

  React.useEffect(() => {
    void restoreSignedInAccount()
      .then((user) => {
        if (user) {
          restoredAccount.current = true;
          setCurrentScreen("DASHBOARD");
        }
      })
      .catch(() => undefined);
  }, []);

  const goTo = (s: ScreenState) => setCurrentScreen(s);

  const renderScreen = () => {
    switch (currentScreen) {
      case "SPLASH":
        return (
          <SplashScreen
            onComplete={() => {
              if (!restoredAccount.current) goTo("FORK");
            }}
          />
        );
      case "FORK":
        return (
          <TheFork
            onLogin={() => goTo("LOGIN")}
            onSignup={() => goTo("SIGNUP")}
          />
        );
      case "LOGIN":
        return (
          <LoginScreen
            onComplete={() => {
              setShowNotificationPrompt(false);
              goTo("DASHBOARD");
            }}
            onBack={() => goTo("FORK")}
          />
        );
      case "SIGNUP":
        return (
          <SignupScreen
            onComplete={() => goTo("CAROUSEL")}
            onSubmit={async (values) => {
              await registerUserAccount(values);
              goTo("CAROUSEL");
            }}
            onBack={() => goTo("FORK")}
          />
        );
      case "CAROUSEL":
        return <IntakeCarousel onComplete={() => goTo("FOG")} />;
      case "FOG":
        return (
          <OnboardingScreen
            onComplete={() => {
              void persistOnboardingCompletion().catch(() => undefined);
              setShowNotificationPrompt(true);
              goTo("DASHBOARD");
            }}
          />
        );
      case "DASHBOARD":
        return (
          <Dashboard
            onProfile={() => goTo("PROFILE")}
            onFocus={() => goTo("FOCUS")}
            onBreathe={() => goTo("BREATHE_DASHBOARD")}
            onOutdoors={() => goTo("OUTDOORS_DASHBOARD")}
            showNotificationPrompt={showNotificationPrompt}
          />
        );
      case "PROFILE":
        return (
          <ProfileScreen
            onBack={() => goTo("DASHBOARD")}
            onLogout={() => goTo("LOGIN")}
          />
        );
      // ---- Coming in phase 2/3 ----
      case "FOCUS":
        return (
          <FocusDashboard
            onBack={() => goTo("DASHBOARD")}
            onGetShitDone={() => goTo("GSD_SETUP")}
            onAlienMode={() => goTo("ALIEN_MODE")}
          />
        );
      case "GSD_SETUP":
        return <GsdSetupScreen onBack={() => goTo("FOCUS")} />;
      case "ALIEN_MODE":
        return <AlienModeScreen onBack={() => goTo("FOCUS")} />;
      case "GSD_TETHER":
      case "GSD_PENALTY":
        return (
          <FeatureDetail
            title="get shit done."
            label="focus setup"
            description="Configure your sound tether and app lock."
            onBack={() => goTo("FOCUS")}
          />
        );
      case "BREATHE_DASHBOARD":
        return (
          <BreatheDashboard
            onBack={() => goTo("DASHBOARD")}
            onCalm={() => goTo("BREATHE_CALM")}
            onRecenter={() => goTo("BREATHE_RECENTER")}
            onClearMind={() => goTo("BREATHE_CLEAR_MIND")}
            onDeepRelax={() => goTo("BREATHE_DEEP_RELAX")}
          />
        );
      case "BREATHE_SETUP":
        return (
          <BreatheExerciseScreen
            exercise="calm-down"
            onBack={() => goTo("BREATHE_DASHBOARD")}
          />
        );
      case "BREATHE_CALM":
        return (
          <BreatheExerciseScreen
            exercise="calm-down"
            onBack={() => goTo("BREATHE_DASHBOARD")}
          />
        );
      case "BREATHE_RECENTER":
        return (
          <BreatheExerciseScreen
            exercise="recenter"
            onBack={() => goTo("BREATHE_DASHBOARD")}
          />
        );
      case "BREATHE_CLEAR_MIND":
        return (
          <BreatheExerciseScreen
            exercise="clear-mind"
            onBack={() => goTo("BREATHE_DASHBOARD")}
          />
        );
      case "BREATHE_DEEP_RELAX":
        return (
          <BreatheExerciseScreen
            exercise="deep-relax"
            onBack={() => goTo("BREATHE_DASHBOARD")}
          />
        );
      case "BREATHE_EXERCISE":
      case "BREATHE_RITUAL":
        return <ComingSoon label="breathe." onBack={() => goTo("DASHBOARD")} />;
      case "OUTDOORS_DASHBOARD":
        return (
          <OutdoorsDashboard
            onBack={() => goTo("DASHBOARD")}
            onBioRadar={() => goTo("OUTDOORS_FEATURE")}
            onCuriosity={() => goTo("OUTDOORS_FEATURE")}
            onSpotFinder={() => goTo("OUTDOORS_FEATURE")}
            onChallenges={() => goTo("OUTDOORS_FEATURE")}
          />
        );
      case "OUTDOORS_FEATURE":
        return (
          <ComingSoon
            label="outdoors feature."
            onBack={() => goTo("OUTDOORS_DASHBOARD")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.outer}>
        <View style={styles.device}>{renderScreen()}</View>
        <StatusBar style="light" />
      </View>
    </GestureHandlerRootView>
  );
}

function FeatureDetail({
  title,
  label,
  description,
  onBack,
}: {
  title: string;
  label: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.featureDetail}>
      <Pressable onPress={onBack}>
        <Text style={styles.featureDetailBack}>← focus state.</Text>
      </Pressable>
      <Text style={styles.featureDetailTitle}>{title}</Text>
      <Text style={styles.featureDetailLabel}>{label}</Text>
      <Text style={styles.featureDetailDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  device: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: "hidden",
  },
  comingSoon: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonTitle: {
    color: colors.white,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1,
  },
  comingSoonSub: {
    color: colors.white40,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  comingSoonBack: {
    color: colors.white50,
    fontSize: 16,
    fontWeight: "500",
  },
  featureDetail: {
    flex: 1,
    backgroundColor: colors.bgDark,
    padding: 32,
    paddingTop: 72,
  },
  featureDetailBack: {
    color: colors.white50,
    fontSize: 16,
    fontWeight: "700",
  },
  featureDetailTitle: {
    color: colors.white,
    fontSize: 52,
    fontWeight: "900",
    marginTop: 72,
  },
  featureDetailLabel: {
    color: colors.rose,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 12,
    textTransform: "uppercase",
  },
  featureDetailDescription: {
    color: colors.white50,
    fontSize: 18,
    lineHeight: 28,
    marginTop: 24,
  },
});
