import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";

import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SwipeAction from "./src/components/SwipeAction";
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
import OutdoorFeatureScreen from "./src/screens/OutdoorFeatureScreen";
import OutdoorsDashboard from "./src/screens/OutdoorsDashboard";
import ProfileScreen from "./src/screens/ProfileScreen";
import SignupScreen from "./src/screens/SignupScreen";
import SplashScreen from "./src/screens/SplashScreen";
import TheFork from "./src/screens/TheFork";
import { colors } from "./src/theme/colors";
import { ScreenState } from "./src/types";
import { firebaseErrorMessage } from "./src/lib/firebase/errors";

// Screens below are not yet ported in this phase — placeholder keeps
// the navigation graph intact and the app runnable end to end.
function ComingSoon({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonTitle}>{label}</Text>
      <Text style={styles.comingSoonSub}>
        Not ported yet — next build phase
      </Text>
      <SwipeAction label="Back to dashboard" onActivate={onBack} />
    </View>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>("SPLASH");
  const [splashFinished, setSplashFinished] = useState(false);
  const [startupResult, setStartupResult] = useState<Awaited<ReturnType<typeof restoreSignedInAccount>> | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStartupError(null);
    setStartupResult(null);
    void restoreSignedInAccount()
      .then((destination) => {
        if (active) setStartupResult(destination);
      })
      .catch((error) => {
        if (active) setStartupError(firebaseErrorMessage(error));
      });
    return () => { active = false; };
  }, [startupAttempt]);

  useEffect(() => {
    if (splashFinished && startupResult && currentScreen === "SPLASH") {
      setCurrentScreen(startupResult);
    }
  }, [splashFinished, startupResult, currentScreen]);

  const finishSignIn = useCallback(async () => {
    const destination = await restoreSignedInAccount();
    if (destination === "FORK") throw new Error("Sign in was not completed. Please try again.");
    setCurrentScreen(destination);
  }, []);

  const goTo = (s: ScreenState) => setCurrentScreen(s);

  const renderScreen = () => {
    switch (currentScreen) {
      case "SPLASH":
        if (splashFinished && startupError) {
          return (
            <View style={styles.startupError}>
              <Text style={styles.startupMessage}>{startupError}</Text>
              <SwipeAction label="Retry connection" onActivate={() => setStartupAttempt((value) => value + 1)} />
            </View>
          );
        }
        return (
          <SplashScreen
            onComplete={() => setSplashFinished(true)}
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
            onComplete={finishSignIn}
            onBack={() => goTo("FORK")}
          />
        );
      case "SIGNUP":
        return (
          <SignupScreen
            onComplete={finishSignIn}
            onSubmit={async (values) => {
              await registerUserAccount(values);
              await finishSignIn();
            }}
            onBack={() => goTo("FORK")}
          />
        );
      case "CAROUSEL":
        return <IntakeCarousel onComplete={() => goTo("FOG")} />;
      case "FOG":
        return (
          <OnboardingScreen
            onComplete={async () => {
              await persistOnboardingCompletion();
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
          />
        );
      case "PROFILE":
        return (
          <ProfileScreen
            onBack={() => goTo("DASHBOARD")}
            onLogout={() => goTo("FORK")}
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
            title="Get shit done."
            label="Focus setup"
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
        return <ComingSoon label="Breathe." onBack={() => goTo("DASHBOARD")} />;
      case "OUTDOORS_DASHBOARD":
        return (
          <OutdoorsDashboard
            onBack={() => goTo("DASHBOARD")}
            onBioRadar={() => goTo("OUTDOORS_BIO")}
            onCuriosity={() => goTo("OUTDOORS_QUIZZES")}
            onSpotFinder={() => goTo("OUTDOORS_SPOTS")}
            onChallenges={() => goTo("OUTDOORS_CHALLENGES")}
          />
        );
      case "OUTDOORS_BIO":
        return (
          <OutdoorFeatureScreen
            feature="bio-radar"
            onBack={() => goTo("OUTDOORS_DASHBOARD")}
          />
        );
      case "OUTDOORS_QUIZZES":
        return (
          <OutdoorFeatureScreen
            feature="quizzes"
            onBack={() => goTo("OUTDOORS_DASHBOARD")}
          />
        );
      case "OUTDOORS_SPOTS":
        return (
          <OutdoorFeatureScreen
            feature="spot-finder"
            onBack={() => goTo("OUTDOORS_DASHBOARD")}
          />
        );
      case "OUTDOORS_CHALLENGES":
        return (
          <OutdoorFeatureScreen
            feature="daily-challenges"
            onBack={() => goTo("OUTDOORS_DASHBOARD")}
          />
        );
      case "OUTDOORS_FEATURE":
        return (
          <ComingSoon
            label="Outdoors feature."
            onBack={() => goTo("OUTDOORS_DASHBOARD")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.outer}>
          <View style={styles.device}>{renderScreen()}</View>
          <StatusBar style="light" />
        </View>
      </SafeAreaProvider>
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
      <SwipeAction label="Focus state" onActivate={onBack} />
      <Text style={styles.featureDetailTitle}>{title}</Text>
      <Text style={styles.featureDetailLabel}>{label}</Text>
      <Text style={styles.featureDetailDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  startupError: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.bgDark,
  },
  startupMessage: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 24,
  },
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
