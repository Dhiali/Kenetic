import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const triggerForkHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
};

function SwipePath({
  direction,
  title,
  description,
  action,
}: {
  direction: "left" | "right";
  title: string;
  description: string;
  action: () => void;
}) {
  const translateX = useSharedValue(0);
  const isReturn = direction === "left";
  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      translateX.value = isReturn
        ? Math.max(-100, Math.min(0, event.translationX))
        : Math.min(100, Math.max(0, event.translationX));
    })
    .onEnd((event) => {
      if (isReturn ? event.translationX < -60 : event.translationX > 60) {
        runOnJS(triggerForkHaptic)();
        runOnJS(action)();
      }
    })
    .onFinalize(() => {
      translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const accessibilityLabel = isReturn
    ? "Return, sign in"
    : "Begin, create an account";
  const actionLabel = isReturn ? "Open sign in" : "Open sign up";

  return (
    <View style={[styles.path, isReturn ? styles.returnPath : styles.beginPath]}>
      <View style={styles.pathHeading}>
        <Text style={[styles.pathNumber, isReturn ? styles.returnAccent : styles.beginAccent]}>
          {isReturn ? "01 / RETURNING" : "02 / NEW HERE"}
        </Text>
        <Text style={styles.pathDescription}>{description}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={`Swipe ${direction}, or activate to ${actionLabel.toLowerCase()}.`}
          accessibilityActions={[{ name: "activate", label: actionLabel }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "activate") action();
          }}
          onAccessibilityTap={action}
          style={[styles.dragArea, dragStyle]}
        >
          {isReturn && <Text style={[styles.arrow, styles.returnAccent]}>{"←"}</Text>}
          <Text style={[styles.pathTitle, isReturn ? styles.returnAccent : styles.beginAccent]}>
            {title}
          </Text>
          {!isReturn && <Text style={[styles.arrow, styles.beginAccent]}>{"→"}</Text>}
        </Animated.View>
      </GestureDetector>
      <Text style={styles.swipeHint}>SWIPE {direction.toUpperCase()}</Text>
    </View>
  );
}

export default function TheForkScreen({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
  }, []);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Where to?</Text>
          <Text style={styles.footer}>A LITTLE MOVEMENT GOES A LONG WAY.</Text>
        </View>

        <View style={styles.paths}>
          <SwipePath
            direction="left"
            title="Return."
            description="Already have an account? Pick up where you left off."
            action={onLogin}
          />
          <SwipePath
            direction="right"
            title="Begin."
            description="New to Kenetic? Let's create your space."
            action={onSignup}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 120,
    paddingBottom: 42,
  },
  header: {
    marginBottom: 38,
  },
  title: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
  },
  paths: {
    gap: 16,
  },
  path: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 22,
    overflow: "hidden",
  },
  returnPath: {
    backgroundColor: "#111e29",
    borderColor: "#274a62",
  },
  beginPath: {
    backgroundColor: "#112219",
    borderColor: "#285438",
  },
  pathHeading: {
    gap: 8,
  },
  pathNumber: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  pathDescription: {
    color: "#d0d0d0",
    fontSize: 14,
    lineHeight: 20,
  },
  dragArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingVertical: 8,
    minHeight: 60,
  },
  pathTitle: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  arrow: {
    fontSize: 30,
    fontWeight: "400",
  },
  returnAccent: {
    color: "#69c3ff",
  },
  beginAccent: {
    color: "#72db94",
  },
  swipeHint: {
    color: "#a9b5ad",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 8,
  },
  footer: {
    color: "#818181",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 12,
  },
});
