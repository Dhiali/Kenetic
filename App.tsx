import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, StyleSheet, Text, Pressable } from "react-native";

import { ScreenState } from "./src/types";
import { colors } from "./src/theme/colors";

import SplashScreen from "./src/screens/SplashScreen";
import TheFork from "./src/screens/TheFork";
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import IntakeCarousel from "./src/screens/IntakeCarousel";
import OnboardingOne from "./src/screens/OnboardingOne";
import OnboardingTwo from "./src/screens/OnboardingTwo";
import GatewayScreen from "./src/screens/GatewayScreen";
import BoundaryPrompt from "./src/screens/BoundaryPrompt";
import Dashboard from "./src/screens/Dashboard";
import ProfileScreen from "./src/screens/ProfileScreen";

// Screens below are not yet ported in this phase — placeholder keeps
// the navigation graph intact and the app runnable end to end.
function ComingSoon({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
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

  const goTo = (s: ScreenState) => setCurrentScreen(s);

  const renderScreen = () => {
    switch (currentScreen) {
      case "SPLASH":
        return <SplashScreen onComplete={() => goTo("FORK")} />;
      case "FORK":
        return (
          <TheFork
            onLogin={() => goTo("LOGIN")}
            onSignup={() => goTo("SIGNUP")}
          />
        );
      case "LOGIN":
        return <LoginScreen onComplete={() => goTo("DASHBOARD")} />;
      case "SIGNUP":
        return <SignupScreen onComplete={() => goTo("CAROUSEL")} />;
      case "CAROUSEL":
        return <IntakeCarousel onComplete={() => goTo("FOG")} />;
      case "FOG":
        return <OnboardingOne onComplete={() => goTo("RITUAL")} />;
      case "RITUAL":
        return <OnboardingTwo onComplete={() => goTo("GATEWAY")} />;
      case "GATEWAY":
        return <GatewayScreen onComplete={() => goTo("BOUNDARY")} />;
      case "BOUNDARY":
        return <BoundaryPrompt onComplete={() => goTo("DASHBOARD")} />;
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
            onLogout={() => goTo("SPLASH")}
          />
        );
      // ---- Coming in phase 2/3 ----
      case "FOCUS":
      case "GSD_SETUP":
      case "GSD_TETHER":
      case "GSD_PENALTY":
      case "ALIEN_MODE":
        return (
          <ComingSoon label="focus." onBack={() => goTo("DASHBOARD")} />
        );
      case "BREATHE_DASHBOARD":
      case "BREATHE_SETUP":
      case "BREATHE_EXERCISE":
      case "BREATHE_RITUAL":
        return (
          <ComingSoon label="breathe." onBack={() => goTo("DASHBOARD")} />
        );
      case "OUTDOORS_DASHBOARD":
      case "OUTDOORS_FEATURE":
        return (
          <ComingSoon label="outdoors." onBack={() => goTo("DASHBOARD")} />
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
});
