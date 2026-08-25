import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  runOnJS,
  FadeOut,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import { hapticLight, hapticMedium, hapticDouble } from "../utils/haptics";

type ItemId = "focus" | "outdoors" | "breathe";

const MENU_ITEMS: { id: ItemId; label: string; color: string }[] = [
  { id: "focus", label: "focus.", color: colors.rose },
  { id: "outdoors", label: "outdoors.", color: colors.green },
  { id: "breathe", label: "breathe.", color: colors.orange },
];

function MenuWord({
  item,
  targetZone,
  disabled,
  onDragStart,
  onDropped,
  onDragCancel,
  hidden,
  dimmed,
}: {
  item: (typeof MENU_ITEMS)[number];
  targetZone: { x: number; y: number; w: number; h: number };
  disabled: boolean;
  onDragStart: (id: ItemId) => void;
  onDropped: (id: ItemId) => void;
  onDragCancel: () => void;
  hidden: boolean;
  dimmed: boolean;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      runOnJS(onDragStart)(item.id);
    })
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const px = e.absoluteX;
      const py = e.absoluteY;
      if (
        px > targetZone.x &&
        py < targetZone.y + targetZone.h &&
        py > targetZone.y
      ) {
        runOnJS(onDropped)(item.id);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
        runOnJS(onDragCancel)();
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    opacity: hidden ? 0 : dimmed ? 0.1 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>
        <Text style={[styles.menuWord, { color: item.color }]}>
          {item.label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

export default function Dashboard({
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
  const { width, height } = useWindowDimensions();
  const [draggingItem, setDraggingItem] = useState<ItemId | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);

  // top-right quadrant, matching the web build's aura drop target
  const targetZone = {
    x: width * 0.35,
    y: 0,
    w: width * 0.65,
    h: height * 0.4,
  };

  const auraLoop = useSharedValue(0);
  useEffect(() => {
    if (draggingItem || selectedItem) return;
    auraLoop.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 6000 }),
        withTiming(0, { duration: 6000 }),
      ),
      -1,
      false,
    );
  }, [draggingItem, selectedItem]);

  const auraStyle = useAnimatedStyle(() => {
    if (draggingItem) {
      const color = MENU_ITEMS.find((m) => m.id === draggingItem)?.color;
      return {
        backgroundColor: color,
        transform: [{ scale: 1.3 }, { translateX: -30 }, { translateY: 30 }],
      };
    }
    const bg = interpolateColor(
      auraLoop.value,
      [0, 0.5, 1],
      [colors.rose, colors.orange, colors.green],
    );
    return {
      backgroundColor: bg,
      transform: [{ scale: 1 }, { translateX: 0 }, { translateY: 0 }],
    };
  });

  const profileX = useSharedValue(0);
  const profileGesture = Gesture.Pan()
    .onUpdate((e) => {
      profileX.value = Math.min(0, Math.max(-60, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < -50) {
        runOnJS(hapticLight)();
        runOnJS(onProfile)();
      }
      profileX.value = withSpring(0);
    });
  const profileStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: profileX.value }],
  }));

  const handleDropped = (id: ItemId) => {
    setSelectedItem(id);
    hapticDouble();
    setTimeout(() => {
      if (id === "focus") onFocus();
      else if (id === "breathe") onBreathe();
      else if (id === "outdoors") onOutdoors();
      setSelectedItem(null);
      setDraggingItem(null);
    }, 1500);
  };

  const wipeColor =
    selectedItem === "focus"
      ? colors.rose
      : selectedItem === "outdoors"
        ? colors.green
        : colors.orange;

  return (
    <Animated.View exiting={FadeOut.duration(400)} style={styles.container}>
      <Animated.View style={[styles.aura, auraStyle]} pointerEvents="none" />

      <View style={styles.content}>
        <Text style={styles.heading}>
          drag state into aura{"\n"}to shift mindsets
        </Text>

        <View style={styles.menuList}>
          {MENU_ITEMS.map((item) => (
            <MenuWord
              key={item.id}
              item={item}
              targetZone={targetZone}
              disabled={!!selectedItem}
              hidden={selectedItem === item.id}
              dimmed={!!draggingItem && draggingItem !== item.id}
              onDragStart={(id) => {
                setDraggingItem(id);
                hapticLight();
              }}
              onDragCancel={() => setDraggingItem(null)}
              onDropped={handleDropped}
            />
          ))}
        </View>
      </View>

      <GestureDetector gesture={profileGesture}>
        <Animated.View style={[styles.profileLink, profileStyle]}>
          <Text style={styles.profileLinkText}>&larr; your profile.</Text>
        </Animated.View>
      </GestureDetector>

      {selectedItem && (
        <Animated.View
          pointerEvents="none"
          entering={undefined}
          style={styles.wipeContainer}
        >
          <View style={[styles.wipeCircle, { backgroundColor: wipeColor }]} />
          <View style={styles.wipeTextWrap}>
            <Text style={styles.wipeText}>
              {MENU_ITEMS.find((m) => m.id === selectedItem)?.label}
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    overflow: "hidden",
  },
  aura: {
    position: "absolute",
    top: -128,
    right: -128,
    width: 500,
    height: 500,
    borderRadius: 250,
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.5,
    lineHeight: 26,
    color: colors.white,
    marginBottom: 72,
  },
  menuList: {
    gap: 28,
    alignItems: "flex-start",
  },
  menuWord: {
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  profileLink: {
    position: "absolute",
    bottom: 48,
    left: 32,
  },
  profileLinkText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.white50,
  },
  wipeContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  wipeCircle: {
    position: "absolute",
    top: "50%",
    right: "-20%",
    width: 320,
    height: 320,
    marginTop: -160,
    borderRadius: 160,
    opacity: 0.95,
  },
  wipeTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  wipeText: {
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
    color: colors.white,
  },
});
