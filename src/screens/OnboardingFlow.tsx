import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import PresenceScreen from "./OnboardingOne";
import CompletionRitualScreen from "./OnboardingTwo";

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <View style={styles.container}>
      {currentStep === 1 && (
        <PresenceScreen onComplete={() => setCurrentStep(2)} />
      )}
      
      {currentStep === 2 && (
        <CompletionRitualScreen onComplete={onComplete} /> 
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
});