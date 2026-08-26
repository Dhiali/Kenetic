import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    Easing,
    FadeIn,
    interpolate,
    interpolateColor,
    runOnJS,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    getNotificationPreference,
    persistDashboardSelection,
    persistNotificationPreference,
    syncNotificationDevice,
} from "../lib/firebase/bootstrap";

const { width, height } = Dimensions.get("window");

export default function DashboardScreen({
  onProfile,
  onFocus,
  onOutdoors,
  onBreathe,
  showNotificationPrompt = true,
}: {
  onProfile: () => void;
  onFocus: () => void;
  onOutdoors: () => void;
  onBreathe: () => void;
  showNotificationPrompt?: boolean;
}) {
  // --------------------------------------------------------
  // Boundary Prompt State
  // --------------------------------------------------------
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
        if (mounted) setShowBoundary(showNotificationPrompt);
      });
    return () => {
      mounted = false;
    };
  }, [showNotificationPrompt]);

  // --------------------------------------------------------
  // Dashboard State (Magnetic Aura & Draggables)
  // --------------------------------------------------------
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    label: string;
    color: string;
  } | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const auraScale = useSharedValue(1);
  const auraOpacity = useSharedValue(0.62);
  const auraProgress = useSharedValue(0);
  const auraSlosh = useSharedValue(0);
  const lavaDrift = useSharedValue(0);
  const wipeScale = useSharedValue(0);
  const wipeOpacity = useSharedValue(1);

  // Aura color shifts based on what is being dragged
  const auraColor = useSharedValue("#00a8ff");

  useEffect(() => {
    // 1. Slow outer expansion/pulse (6 seconds)
    auraScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    // 3. Vertical drift cycle (9 seconds)
    auraProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    // 2. Slow horizontal slosh & morph cycle (7.5 seconds)
    auraSlosh.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 7500, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 7500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    lavaDrift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 6800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const dismissBoundary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    boundaryOpacity.value = withTiming(0, { duration: 400 });
    setTimeout(() => {
      setShowBoundary(false);
    }, 400);
  };

  const handleNotificationChoice = async (choice: "later" | "sure") => {
    if (savingPreference) return;
    setSavingPreference(true);
    try {
      await persistNotificationPreference(choice);
      dismissBoundary();
    } catch {
      setSavingPreference(false);
    }
  };

  const handleDropSuccess = async (
    id: string,
    label: string,
    color: string,
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setSelectionError(null);
    setSelectedItem({ id, label, color });
    wipeScale.value = withTiming(40, { duration: 1000 });
    try {
      await persistDashboardSelection(id as "focus" | "outdoors" | "breathe");
      setTimeout(() => {
        if (id === "focus") onFocus();
        if (id === "outdoors") onOutdoors();
        if (id === "breathe") onBreathe();
      }, 1000);
    } catch {
      setSelectedItem(null);
      setSelectionError("Could not save your state. Try again.");
      wipeScale.value = withTiming(0, { duration: 260 });
    }
  };

  // --------------------------------------------------------
  // Draggable Dashboard Item Component
  // --------------------------------------------------------
  const DraggableMenuItem = ({ id, label, color, action }: any) => {
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const isGrabbed = useSharedValue(false);

    const gesture = Gesture.Pan()
      .enabled(!showBoundary && !selectedItem) // Disable interaction during the prompt or state transition
      .onBegin(() => {
        isGrabbed.value = true;
        runOnJS(setDraggingItem)(id);
        auraColor.value = withTiming(color, { duration: 300 });
        auraOpacity.value = withTiming(0.82, { duration: 300 });
        runOnJS(triggerImpact)(Haptics.ImpactFeedbackStyle.Light);
      })
      .onUpdate((e) => {
        x.value = e.translationX;
        y.value = e.translationY;
      })
      .onEnd((e) => {
        isGrabbed.value = false;
        runOnJS(setDraggingItem)(null);
        auraColor.value = withTiming("#00a8ff", { duration: 500 });
        auraOpacity.value = withTiming(0.62, { duration: 500 });

        // If dropped in the top-right quadrant (Magnetic Aura)
        if (e.translationX > 50 && e.translationY < -100) {
          x.value = withSpring(150, { damping: 15, stiffness: 200 });
          y.value = withSpring(-150, { damping: 15, stiffness: 200 });
          runOnJS(handleDropSuccess)(id, label, color);
        } else {
          // Snap back
          x.value = withSpring(0, { damping: 12, stiffness: 200 });
          y.value = withSpring(0, { damping: 12, stiffness: 200 });
        }
      });

    const style = useAnimatedStyle(() => ({
      transform: [{ translateX: x.value }, { translateY: y.value }],
      opacity: draggingItem && draggingItem !== id ? 0.2 : 1, // Dim others
      color,
    }));

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.menuItemLayer}>
          <Animated.Text style={[styles.cursiveMenuItem, style]}>
            {label}
          </Animated.Text>
        </Animated.View>
      </GestureDetector>
    );
  };

  // --------------------------------------------------------
  // Animated Styles
  // --------------------------------------------------------
  const auraStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: auraScale.value },
      { translateX: interpolate(auraSlosh.value, [-1, 1], [-25, 25]) },
      { translateY: interpolate(auraProgress.value, [0, 1], [-20, 20]) },
      // Morphing container shape organically using opposing X/Y scales
      { scaleX: interpolate(auraSlosh.value, [-1, 1], [0.88, 1.16]) },
      { scaleY: interpolate(auraProgress.value, [0, 1], [1.18, 0.86]) },
      { rotate: `${interpolate(auraSlosh.value, [-1, 1], [-8, 8])}deg` },
    ],
    opacity: auraOpacity.value,
  }));

  const boundaryOverlayStyle = useAnimatedStyle(() => ({
    opacity: boundaryOpacity.value,
  }));

  const lavaOneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(lavaDrift.value, [-1, 1], [95, -70]) },
      { translateY: interpolate(auraProgress.value, [0, 1], [70, -55]) },
      { scaleX: interpolate(auraSlosh.value, [-1, 1], [0.82, 1.2]) },
      { scaleY: interpolate(auraProgress.value, [0, 1], [1.25, 0.78]) },
    ],
    backgroundColor: interpolateColor(
      auraProgress.value,
      [0, 0.5, 0],
      ["#00a8ff", "#9b4dff", "#ecda34"],
    ),
    borderRadius: 260,
    opacity: 0.58,
  }));

  const lavaTwoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(lavaDrift.value, [-1, 1], [-80, 100]) },
      { translateY: interpolate(auraSlosh.value, [-1, 1], [-60, 75]) },
      { scaleX: interpolate(auraProgress.value, [0, 1], [1.3, 0.76]) },
      { scaleY: interpolate(auraSlosh.value, [-1, 1], [0.72, 1.3]) },
    ],
    backgroundColor: interpolateColor(
      auraSlosh.value,
      [-1, 0, 1],
      ["#9b4dff", "#e7d219", "#00a8ff"],
    ),
    borderRadius: 240,
    opacity: 1,
  }));

  const profileX = useSharedValue(0);
  const profileGesture = Gesture.Pan()
    .enabled(!selectedItem)
    .onUpdate((event) => {
      profileX.value =
        event.translationX > 0 ? event.translationX * 0.1 : event.translationX;
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

  const wipeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wipeScale.value }],
    backgroundColor: selectedItem?.color || "transparent",
    opacity: wipeOpacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.container}>
      {/* --------------------------------------------------- */}
      {/* 1. The Dashboard Base Layer */}
      {/* --------------------------------------------------- */}

      {/* Top Right Magnetic Aura */}
      <Animated.View style={[styles.aura, auraStyle]}>
        <Animated.View style={[styles.lavaBlob, lavaOneStyle]} />
        <Animated.View style={[styles.lavaBlob, lavaTwoStyle]} />
        <BlurView intensity={92} tint="light" style={styles.auraBlurLayer} />
      </Animated.View>

      <View style={styles.dashboardContent} pointerEvents="box-none">
        <View style={styles.headerBlock}>
          <Text style={styles.headlineText}>
            Drag your desired{"\n"}state into the{"\n"}aura above.
          </Text>
        </View>
        {selectionError && (
          <Text style={styles.selectionError}>{selectionError}</Text>
        )}

        <View style={styles.menuContainer} pointerEvents="box-none">
          <DraggableMenuItem
            id="focus"
            label="Focus"
            color="#e11d48"
            action={onFocus}
          />
          <DraggableMenuItem
            id="outdoors"
            label="Outdoors"
            color="#16a34a"
            action={onOutdoors}
          />
          <DraggableMenuItem
            id="breathe"
            label="Breathe"
            color="#f97316"
            action={onBreathe}
          />
        </View>

        {/* Profile Anchor (Bottom Left) */}
        <GestureDetector gesture={profileGesture}>
          <Animated.Text style={[styles.profileText, profileStyle]}>
            Your profile. &rarr;
          </Animated.Text>
        </GestureDetector>
      </View>

      {/* --------------------------------------------------- */}
      {/* 2. The Boundary Prompt Overlay */}
      {/* --------------------------------------------------- */}
      {showBoundary && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.boundaryOverlay,
            boundaryOverlayStyle,
          ]}
        >
          {/* Blurs the entire dashboard beneath it */}
          <BlurView
            intensity={40}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />

          {/* The Slide-Up Card */}
          <Animated.View
            entering={SlideInDown.duration(520)}
            exiting={SlideOutDown.duration(400)}
            style={styles.boundaryCard}
          >
            <Text style={styles.boundaryTitle}>
              Would you like push notifications from kenetic?
            </Text>

            <Text style={styles.boundaryText}>
              Swipe an option to choose how kenetic keeps you in the loop.
            </Text>

            <View style={styles.boundaryActions}>
              <SwipeOption
                label="Maybe later"
                accent="#9ca3af"
                onChoose={() => handleNotificationChoice("later")}
              />
              <SwipeOption
                label="Sure"
                accent="#16a34a"
                onChoose={() => handleNotificationChoice("sure")}
              />
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {selectedItem && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.wipeCircle, wipeStyle]} />
          <Animated.View style={styles.wipeTextContainer}>
            <Animated.Text
              entering={FadeIn.delay(260).duration(760)}
              style={styles.selectedStateText}
            >
              {selectedItem.label}
            </Animated.Text>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

const triggerImpact = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => undefined);
};

function SwipeOption({
  label,
  accent,
  onChoose,
}: {
  label: string;
  accent: string;
  onChoose: () => void;
}) {
  const translateX = useSharedValue(0);
  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      translateX.value = Math.max(0, event.translationX);
    })
    .onEnd(() => {
      if (translateX.value > 70) {
        runOnJS(onChoose)();
      }
      translateX.value = withSpring(0, { damping: 15, stiffness: 180 });
    });
  const optionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: translateX.value > 70 ? 0.55 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.Text
        style={[styles.notificationOption, { color: accent }, optionStyle]}
      >
        {label} →
      </Animated.Text>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111315",
  },

  // Dashboard Styles
  aura: {
    position: "absolute",
    top: -150,
    right: -100,
    width: 600,
    height: 500,
    borderRadius: 300,
    overflow: "hidden",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 52,
    elevation: 18,
  },
  auraBlurLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
  },
  lavaBlob: {
    position: "absolute",
    width: "82%",
    height: "92%",
    top: "20%",
    left: "9%",
    shadowColor: "#9b4dff",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 2,
    shadowRadius: 54,
    elevation: 66,
  },
  dashboardContent: {
    flex: 1,
    padding: 32,
    paddingTop: 80,
    justifyContent: "space-between",
  },
  headerBlock: {
    marginTop: 20,
    marginBottom: 40,
    transform: [{ translateY: 170 }],
  },
  selectionError: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  headlineText: {
    fontSize: 35,
    lineHeight: 40,
    fontWeight: "800",
    color: "rgba(150, 147, 152, 0.82)",
    letterSpacing: -1,
  },
  menuContainer: {
    gap: 15,
    paddingLeft: 8,
    transform: [{ translateY: 50 }],
  },
  menuItemLayer: {
    zIndex: 1,
  },
  cursiveMenuItem: {
    fontSize: 60,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontStyle: "italic",
    letterSpacing: -1,
    zIndex: 10,
    paddingVertical: 10,
  },
  selectedStateText: {
    fontSize: 82,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontStyle: "italic",
    fontWeight: "900",
    letterSpacing: -2,
    color: "#ffffff",
    textShadowColor: "rgba(255, 255, 255, 0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  profileText: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: -0.5,
    marginBottom: 20,
    paddingVertical: 10,
  },

  // Boundary Prompt Styles
  boundaryOverlay: {
    zIndex: 20,
  },
  boundaryCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "85%",
    // Keep dashboard content visible behind the sheet while preserving the card layer.
    backgroundColor: "rgba(18, 18, 18, 0.78)",
    borderTopLeftRadius: 72,
    borderTopRightRadius: 32,
    padding: 32,
    paddingTop: 58,
    paddingBottom: 64,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 1,
  },
  boundaryTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1,
    marginBottom: 16,
  },
  boundaryText: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
    lineHeight: 24,
    marginBottom: 48,
  },
  boundaryActions: {
    alignItems: "flex-start",
    gap: 20,
    marginTop: 18,
  },
  notificationOption: {
    fontSize: 24,
    fontWeight: "800",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  wipeCircle: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    zIndex: 50,
  },
  wipeTextContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
  },
});
