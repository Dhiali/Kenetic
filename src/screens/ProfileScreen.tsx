import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import { hapticLight, hapticDouble } from "../utils/haptics";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTIONS = [
  {
    id: "privacy",
    label: "privacy.",
    content:
      "Your data is encrypted. We do not sell your physiological metrics to third parties. Ever.",
  },
  {
    id: "terms",
    label: "terms.",
    content:
      "By using kenetic, you agree to respect your own boundaries. Do not use while operating heavy machinery.",
  },
  {
    id: "support",
    label: "support.",
    content: "Reach out to terminal@kenetic.app for immediate assistance.",
  },
];

export default function ProfileScreen({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("Jane Doe");
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === id ? null : id));
    hapticLight();
  };

  const editX = useSharedValue(0);
  const editGesture = Gesture.Pan()
    .enabled(!isEditing)
    .onUpdate((e) => {
      editX.value = Math.min(80, Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > 50) {
        runOnJS(setIsEditing)(true);
        runOnJS(hapticLight)();
      }
      editX.value = withSpring(0);
    });
  const editStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: editX.value }],
  }));

  const backX = useSharedValue(0);
  const backGesture = Gesture.Pan()
    .onUpdate((e) => {
      backX.value = Math.max(0, Math.min(150, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > 80) {
        runOnJS(onBack)();
      }
      backX.value = withSpring(0);
    });
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: backX.value }],
  }));

  const logoutY = useSharedValue(0);
  const logoutGesture = Gesture.Pan()
    .onUpdate((e) => {
      logoutY.value = Math.max(0, Math.min(150, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 100) {
        runOnJS(hapticDouble)();
        runOnJS(onLogout)();
      }
      logoutY.value = withSpring(0);
    });
  const logoutStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoutY.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            }}
            style={styles.avatarImg}
          />
          {isEditing && (
            <View style={styles.avatarOverlay}>
              <Text style={styles.avatarOverlayText}>upload</Text>
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            {isEditing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                style={styles.nameInput}
              />
            ) : (
              <Text style={styles.nameText}>{name.toLowerCase()}.</Text>
            )}
          </View>
          {!isEditing && (
            <GestureDetector gesture={editGesture}>
              <Animated.View style={[styles.editBadge, editStyle]}>
                <Text style={styles.editBadgeText}>drag to edit &rarr;</Text>
              </Animated.View>
            </GestureDetector>
          )}
        </View>
        <Text style={styles.joined}>joined 24 august 2026</Text>
      </View>

      <View style={styles.sections}>
        {SECTIONS.map((item) => (
          <View key={item.id} style={styles.sectionItem}>
            <Pressable onPress={() => toggleSection(item.id)}>
              <Text style={styles.sectionLabel}>{item.label}</Text>
            </Pressable>
            {expanded === item.id && (
              <Text style={styles.sectionContent}>{item.content}</Text>
            )}
          </View>
        ))}
      </View>

      <GestureDetector gesture={backGesture}>
        <Animated.View style={[styles.backLink, backStyle]}>
          <Text style={styles.backLinkText}>&rarr; dashboard.</Text>
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={logoutGesture}>
        <Animated.View style={[styles.logoutLink, logoutStyle]}>
          <Text style={styles.logoutLinkText}>logout.</Text>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    padding: 32,
  },
  top: {
    marginTop: 80,
    gap: 20,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#1f2937",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlayText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  nameText: {
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
    color: colors.white,
  },
  nameInput: {
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
    color: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.3)",
    paddingBottom: 6,
  },
  editBadge: {
    borderWidth: 1,
    borderColor: colors.white10,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
    marginBottom: 8,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.white30,
  },
  joined: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.white40,
    marginTop: 4,
  },
  sections: {
    marginTop: 60,
    alignItems: "flex-end",
    gap: 24,
  },
  sectionItem: {
    alignItems: "flex-end",
    width: "100%",
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.5,
    color: "rgba(255,255,255,0.7)",
  },
  sectionContent: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.white40,
    marginTop: 8,
    maxWidth: 260,
    textAlign: "right",
  },
  backLink: {
    position: "absolute",
    bottom: 48,
    left: 32,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.white50,
  },
  logoutLink: {
    position: "absolute",
    bottom: 48,
    right: 32,
  },
  logoutLinkText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.rose,
  },
});
