import React from "react";
import { StyleSheet, Text, View } from "react-native";
import SwipeAction from "./SwipeAction";

export function AiConsentNotice() {
  return <>
    <Text style={styles.text}>
      AI sends tasks and photos to Google Gemini through Kenetic's hosting provider. Google may use free-tier inputs and responses to improve its products, and human reviewers may read them. Do not send personal, sensitive, or confidential information.
    </Text>
    <Text style={styles.text}>
      AI is for adults only and is unavailable in the UK, EEA, Switzerland, and other unsupported regions. Results can be wrong. Daily limits apply.
    </Text>
    <Text style={styles.text}>Your agreement applies to Alien Mode and Bio Radar. You can withdraw it in your profile.</Text>
  </>;
}

export default function AiConsent({ disabled = false, onAgree }: { disabled?: boolean; onAgree: () => void }) {
  return <View style={styles.notice}>
    <AiConsentNotice />
    <SwipeAction label="I am 18 or older and agree to AI use" disabled={disabled} onActivate={onAgree} />
  </View>;
}

const styles = StyleSheet.create({
  notice: { gap: 8, paddingVertical: 8 },
  text: { color: "#eeeeee", fontSize: 13, lineHeight: 19 },
});
