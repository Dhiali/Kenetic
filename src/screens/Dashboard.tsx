import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
    cancelAnimation,
    Easing,
    FadeIn,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { persistDashboardSelection } from "../lib/firebase/bootstrap";

type DashboardItem = "focus" | "outdoors" | "breathe";

function AmbientAura() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(drift);
  }, [drift]);

  const firstStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -20 + drift.value * 40 },
      { translateY: -10 + drift.value * 20 },
      { scale: 1.15 },
    ],
  }));
  const secondStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 20 - drift.value * 40 },
      { translateY: 15 - drift.value * 30 },
      { scale: 1.15 },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#1b1b27", "#111315", "#111315"]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, firstStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="dashboardViolet" cx="30%" cy="28%" rx="62%" ry="42%">
              <Stop offset="0" stopColor="#7853aa" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#7853aa" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dashboardViolet)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, secondStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="dashboardTeal" cx="75%" cy="58%" rx="62%" ry="45%">
              <Stop offset="0" stopColor="#368f84" stopOpacity="0.16" />
              <Stop offset="1" stopColor="#368f84" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dashboardTeal)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

function DraggableMenuItem({
  id,
  label,
  color,
  description,
  disabled,
  draggingItem,
  setDraggingItem,
  onChoose,
}: {
  id: DashboardItem;
  label: string;
  color: string;
  description: string;
  disabled: boolean;
  draggingItem: string | null;
  setDraggingItem: (id: string | null) => void;
  onChoose: (id: DashboardItem, label: string) => void;
}) {
  const y = useSharedValue(0);
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      runOnJS(setDraggingItem)(id);
      runOnJS(triggerImpact)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      y.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY < -100) {
        runOnJS(onChoose)(id, label);
      }
    })
    .onFinalize(() => {
      runOnJS(setDraggingItem)(null);
      y.value = withSpring(0, { damping: 15, stiffness: 200 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Open ${label} state`}
        accessibilityHint="Drag up, or activate to choose this state."
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate", label: `Open ${label}` }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === "activate") onChoose(id, label);
        }}
        onAccessibilityTap={() => { if (!disabled) onChoose(id, label); }}
        style={[
          styles.menuItemLayer,
          draggingItem === id && styles.menuItemDragging,
          draggingItem && draggingItem !== id && styles.menuItemDimmed,
          dragStyle,
        ]}
      >
        <View>
          <Text style={[styles.menuItemTitle, { color }]}>{label}</Text>
          <Text style={styles.menuItemDescription}>{description}</Text>
        </View>
        <Text style={[styles.menuArrow, { color }]}>↑</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export default function DashboardScreen({
  onProfile,
  onFocus,
  onOutdoors,
  onBreathe,
}: {
  onProfile: () => void;
  onFocus: () => void;
  onOutdoors: () => void;
  onBreathe: () => void;
}) {
  const selectionInProgress = useRef(false);
  const { height } = useWindowDimensions();
  const compact = height < 700;

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    label: string;
    color: string;
  } | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);

  const handleDropSuccess = async (
    id: DashboardItem,
    label: string,
  ) => {
    if (selectionInProgress.current) return;
    selectionInProgress.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setSelectionError(null);
    const transitionColor = { focus: "#e11d48", outdoors: "#16a34a", breathe: "#f97316" }[id];
    setSelectedItem({ id, label, color: transitionColor });
    try {
      await persistDashboardSelection(id);
      setTimeout(() => {
        if (id === "focus") onFocus();
        if (id === "outdoors") onOutdoors();
        if (id === "breathe") onBreathe();
      }, 1000);
    } catch {
      selectionInProgress.current = false;
      setSelectedItem(null);
      setSelectionError("Could not save your state. Try again.");
    }
  };

  const profileX = useSharedValue(0);
  const profileGesture = Gesture.Pan()
    .enabled(!selectedItem)
    .onUpdate((event) => {
      profileX.value = Math.max(0, Math.min(100, event.translationX));
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
    <Animated.View entering={FadeIn.duration(600)} style={styles.container}>
      <AmbientAura />

      <View
      style={[styles.dashboardContent, compact && styles.dashboardContentCompact]}
      pointerEvents="box-none"
      accessibilityElementsHidden={Boolean(selectedItem)}
      importantForAccessibility={selectedItem ? "no-hide-descendants" : "auto"}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.headlineText}>
            Find your{"\n"}state.
          </Text>
          <Text style={styles.headlineHint}>Drag a state upward into the void to enter.</Text>
        </View>
        {selectionError && (
          <Text style={styles.selectionError}>{selectionError}</Text>
        )}

        <View style={styles.menuContainer} pointerEvents="box-none">
          <DraggableMenuItem
            id="focus"
            label="Focus"
            color="#fb7185"
            description="Make space for what matters."
            disabled={Boolean(selectedItem)}
            draggingItem={draggingItem}
            setDraggingItem={setDraggingItem}
            onChoose={handleDropSuccess}
          />
          <DraggableMenuItem
            id="outdoors"
            label="Outdoors"
            color="#86efac"
            description="Reconnect with the outdoors."
            disabled={Boolean(selectedItem)}
            draggingItem={draggingItem}
            setDraggingItem={setDraggingItem}
            onChoose={handleDropSuccess}
          />
          <DraggableMenuItem
            id="breathe"
            label="Breathe"
            color="#fdba74"
            description="Pause and find your rhythm."
            disabled={Boolean(selectedItem)}
            draggingItem={draggingItem}
            setDraggingItem={setDraggingItem}
            onChoose={handleDropSuccess}
          />
        </View>

        {/* Profile Anchor (Bottom Left) */}
        <GestureDetector gesture={profileGesture}>
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Open your profile"
            accessibilityState={{ disabled: Boolean(selectedItem) }}
            accessibilityActions={[{ name: "activate", label: "Open profile" }]}
            onAccessibilityAction={(event) => {
              if (!selectedItem && event.nativeEvent.actionName === "activate") onProfile();
            }}
            onAccessibilityTap={() => { if (!selectedItem) onProfile(); }}
            style={profileStyle}
          >
            <Text style={styles.profileText}>Your profile. &rarr;</Text>
          </Animated.View>
        </GestureDetector>
      </View>

      {selectedItem && (
        <View style={[styles.transitionOverlay, { backgroundColor: selectedItem.color }]} accessibilityViewIsModal>
          <Animated.View style={styles.wipeTextContainer}>
            <Animated.Text
              entering={FadeIn.duration(400)}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111315",
  },

  dashboardContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 135,
    paddingBottom: 85,
    justifyContent: "space-between",
  },
  dashboardContentCompact: {
    paddingTop: 80,
    paddingBottom: 48,
  },
  headerBlock: {
    maxWidth: 250,
  },
  selectionError: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  headlineText: {
    fontSize: 42,
    lineHeight: 45,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1.5,
  },
  headlineHint: {
    color: "#c5c6c8",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    maxWidth: 220,
  },
  menuContainer: {
    gap: 4,
  },
  menuItemLayer: {
    zIndex: 1,
    minHeight: 78,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  menuItemDimmed: {
    opacity: 0.3,
  },
  menuItemDragging: {
    zIndex: 10,
  },
  menuItemTitle: {
    fontSize: 42,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontStyle: "italic",
    letterSpacing: -1,
  },
  menuItemDescription: {
    color: "#bfc0c2",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 27,
    paddingHorizontal: 4,
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
    color: "#c5c6c8",
    letterSpacing: -0.5,
    paddingVertical: 10,
  },

  transitionOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  wipeTextContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
  },
});
