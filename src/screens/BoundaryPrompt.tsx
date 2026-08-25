import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { colors } from "../theme/colors";

export default function BoundaryPrompt({
  onComplete,
}: {
  onComplete: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={styles.container}
    >
      <Text style={styles.title}>allow{"\n"}boundaries?</Text>
      <View style={styles.buttons}>
        <Pressable onPress={onComplete} style={styles.allowBtn}>
          <Text style={styles.allowText}>allow</Text>
        </Pressable>
        <Pressable onPress={onComplete} style={styles.notNowBtn}>
          <Text style={styles.notNowText}>not now</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
    color: colors.textDark,
    marginBottom: 64,
  },
  buttons: {
    width: "100%",
    maxWidth: 200,
    gap: 20,
  },
  allowBtn: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: colors.black,
    borderRadius: 999,
    alignItems: "center",
  },
  allowText: {
    color: colors.white,
    fontWeight: "700",
  },
  notNowBtn: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
  },
  notNowText: {
    color: "#9ca3af",
    fontWeight: "700",
  },
});
