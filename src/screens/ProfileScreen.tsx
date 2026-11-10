import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    Easing,
    FadeIn,
    interpolate,
    interpolateColor,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    deleteCurrentAccount,
    loadCurrentProfile,
    persistProfileEmail,
    persistProfileName,
    persistProfilePhotoUrl,
    reauthenticateAccount,
    signOutCurrentAccount,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import SwipeAction from "../components/SwipeAction";
import AiConsent, { AiConsentNotice } from "../components/AiConsent";
import { useAiConsent } from "../lib/ai/useAiConsent";
import { colors } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

const sections = {
  privacy:
    "Your data is encrypted. We do not sell physiological metrics to third parties.",
  terms:
    "By using Kenetic, you agree to respect your own boundaries. Do not use while driving or operating machinery.",
  support:
    "Need a hand? Email terminal@kenetic.app and our support team will help.",
};

const PHOTO_OPTIONS = [
  {
    id: "sunlit",
    label: "Sunlit",
    uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=85",
  },
  {
    id: "quiet",
    label: "Quiet",
    uri: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=85",
  },
];

export default function ProfileScreen({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showDeleteReauth, setShowDeleteReauth] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const logoutInProgress = useRef(false);
  const aiConsent = useAiConsent();
  const blobProgress = useSharedValue(0);

  useEffect(() => {
    blobProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    let mounted = true;
    void loadCurrentProfile()
      .then((profile) => {
        if (!mounted) return;
        setName(profile?.displayName ?? "");
        setEmail(profile?.email ?? "");
        setEmailDraft(profile?.email ?? "");
        setPhotoUrl(profile?.photoUrl ?? null);
      })
      .catch((error) => {
        if (mounted) setMessage(firebaseErrorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const avatarStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: interpolate(blobProgress.value, [0, 1], [68, 42]),
    borderTopRightRadius: interpolate(blobProgress.value, [0, 1], [42, 68]),
    borderBottomRightRadius: interpolate(blobProgress.value, [0, 1], [68, 42]),
    borderBottomLeftRadius: interpolate(blobProgress.value, [0, 1], [42, 68]),
    borderColor: interpolateColor(
      blobProgress.value,
      [0, 0.5, 1],
      [colors.green, colors.orange, colors.rose],
    ),
  }));

  const editX = useSharedValue(0);
  const editGesture = Gesture.Pan()
    .enabled(!editing)
    .onUpdate((event) => {
      editX.value = Math.max(0, Math.min(80, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX > 50) {
        runOnJS(setShowPhotoOptions)(true);
        runOnJS(hapticLight)();
      }
      editX.value = withSpring(0);
    });
  const editStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: editX.value }],
  }));

  const logout = async () => {
    if (logoutInProgress.current) return;
    logoutInProgress.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await signOutCurrentAccount();
      onLogout();
    } catch (error) {
      setMessage(firebaseErrorMessage(error));
    } finally {
      logoutInProgress.current = false;
      setSaving(false);
    }
  };

  const logoutX = useSharedValue(0);
  const logoutGesture = Gesture.Pan()
    .enabled(!saving)
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      logoutX.value = Math.max(0, Math.min(100, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX > 70) {
        runOnJS(hapticLight)();
        runOnJS(logout)();
      }
    })
    .onFinalize(() => {
      logoutX.value = withSpring(0, { damping: 15, stiffness: 200 });
    });
  const logoutStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: logoutX.value }],
  }));

  const saveName = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await persistProfileName(name);
      setName(name.trim().replace(/\s+/g, " "));
      setEditing(false);
      hapticLight();
    } catch (error) {
      setMessage(firebaseErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveEmail = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await persistProfileEmail(emailDraft, currentPassword);
      const normalizedEmail = emailDraft.trim().toLowerCase();
      setEmail(normalizedEmail);
      setEmailDraft(normalizedEmail);
      setCurrentPassword("");
      setEditingEmail(false);
      hapticLight();
    } catch (error) {
      setMessage(firebaseErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  async function choosePhoto(uri: string) {
    setSaving(true);
    setMessage(null);
    try {
      await persistProfilePhotoUrl(uri);
      setPhotoUrl(uri);
      setShowPhotoOptions(false);
      hapticLight();
    } catch (error) {
      setMessage(firebaseErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const confirmDelete = () => {
    setMessage(null);
    setShowDeleteReauth(true);
  };

  const deleteAccount = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await reauthenticateAccount(deletePassword);
      await deleteCurrentAccount();
      onLogout();
    } catch (error) {
      setMessage(firebaseErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(460)} style={styles.container}>
      {showDeleteReauth && (
        <View style={styles.deleteReauthOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboard}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
          <ScrollView
            contentContainerStyle={styles.deleteReauthContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            alwaysBounceVertical
          >
          <View style={styles.deleteReauthPanel}>
            <Text style={styles.deleteReauthTitle}>Confirm deletion.</Text>
            <Text style={styles.deleteReauthText}>
              This permanently deletes your profile and saved data. Enter your
              current password to confirm.
            </Text>
            <TextInput
              accessibilityLabel="Current password for account deletion"
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Current password"
              placeholderTextColor={colors.white50}
              style={styles.deletePasswordInput}
            />
            {message && <Text style={styles.message}>{message}</Text>}
            <View style={styles.deleteReauthActions}>
              <SwipeAction
                label="Cancel"
                onActivate={() => {
                  setDeletePassword("");
                  setShowDeleteReauth(false);
                }}
                disabled={saving}
              />
              <SwipeAction label={saving ? "Deleting..." : "Delete permanently"} onActivate={() => void deleteAccount()} disabled={saving} />
            </View>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        alwaysBounceVertical
      >
        <Text style={styles.eyebrow}>Your profile</Text>
        <View style={styles.identity}>
          <View style={styles.photoRow}>
            <Animated.View style={[styles.avatar, avatarStyle]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {name.slice(0, 1) || "K"}
                </Text>
              )}
            </Animated.View>
            <GestureDetector gesture={editGesture}>
              <Animated.View style={[styles.photoEdit, editStyle]}>
                <Text style={styles.photoEditText}>
                  {saving ? "Saving..." : "Swipe right to edit →"}
                </Text>
              </Animated.View>
            </GestureDetector>
          </View>
          {showPhotoOptions && (
            <View style={styles.photoOptions}>
              <Text style={styles.photoOptionsTitle}>Choose your image</Text>
              <View style={styles.photoChoices}>
                {PHOTO_OPTIONS.map((option) => (
                  <View
                    key={option.id}
                    style={styles.photoChoice}
                  >
                    <Image
                      source={{ uri: option.uri }}
                      style={styles.choiceImage}
                    />
                    <Text style={styles.choiceLabel}>{option.label}</Text>
                    <SwipeAction label={`Choose ${option.label}`} onActivate={() => void choosePhoto(option.uri)} disabled={saving} />
                  </View>
                ))}
              </View>
            </View>
          )}
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : editing ? (
            <View style={styles.nameEditor}>
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="Your name"
                placeholderTextColor={colors.white40}
                style={styles.nameInput}
              />
              <SwipeAction label={saving ? "Saving..." : "Save name"} onActivate={() => void saveName()} disabled={saving} />
            </View>
          ) : (
            <Text style={styles.nameText}>
              {name || "Your name"}.
            </Text>
          )}
          {!editing && (
            <SwipeAction label="Edit name" onActivate={() => setEditing(true)} />
          )}
          <View style={styles.emailBlock}>
            <Text style={styles.emailLabel}>Email</Text>
            {editingEmail ? (
              <View style={styles.emailEditor}>
                <TextInput
                  value={emailDraft}
                  onChangeText={setEmailDraft}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  placeholder="Your email"
                  placeholderTextColor={colors.white40}
                  style={styles.emailInput}
                />
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Current password"
                  placeholderTextColor={colors.white40}
                  style={styles.emailInput}
                />
                <View style={styles.emailActions}>
                  <SwipeAction label={saving ? "Saving..." : "Save email"} onActivate={() => void saveEmail()} disabled={saving} />
                  <SwipeAction label="Cancel" onActivate={() => setEditingEmail(false)} disabled={saving} />
                </View>
              </View>
            ) : (
              <View style={styles.emailRow}>
                <Text style={styles.emailText}>
                  {email || "No email connected"}
                </Text>
                <SwipeAction label="Edit email" onActivate={() => setEditingEmail(true)} />
              </View>
            )}
          </View>
        </View>
        {!showDeleteReauth && message && <Text style={styles.message}>{message}</Text>}
        <View style={styles.sectionList}>
          <View style={styles.sectionItem}>
            <SwipeAction
              label={`${expanded === "ai" ? "Close" : "Open"} AI agreement`}
              onActivate={() => setExpanded(expanded === "ai" ? null : "ai")}
            />
            {expanded === "ai" && (
              <View style={styles.aiAgreement}>
                {aiConsent.status === "loading" && <Text style={styles.sectionContent}>Checking AI agreement...</Text>}
                {aiConsent.status === "agreed" && (
                  <>
                    <Text style={styles.sectionContent}>AI agreement active for this account.</Text>
                    <AiConsentNotice />
                    <SwipeAction label="Withdraw AI agreement" disabled={aiConsent.saving} onActivate={() => void aiConsent.change(false)} />
                  </>
                )}
                {aiConsent.status === "not-agreed" && (
                  <AiConsent disabled={aiConsent.saving} onAgree={() => void aiConsent.change(true)} />
                )}
                {!!aiConsent.error && <Text style={styles.message}>{aiConsent.error}</Text>}
                {aiConsent.status === "error" && <SwipeAction label="Retry checking AI agreement" onActivate={() => void aiConsent.refresh()} />}
              </View>
            )}
          </View>
          {Object.entries(sections).map(([key, value]) => (
            <View key={key} style={styles.sectionItem}>
              <SwipeAction
                label={`${expanded === key ? "Close" : "Open"} ${key}`}
                onActivate={() => {
                  setExpanded(expanded === key ? null : key);
                  hapticLight();
                }}
              />
              {expanded === key && (
                <Text style={styles.sectionContent}>{value}</Text>
              )}
              {key === "support" && expanded === key && (
                <SwipeAction
                  label="Email support"
                  onActivate={() =>
                    void Linking.openURL("mailto:terminal@kenetic.app")
                  }
                />
              )}
            </View>
          ))}
        </View>
        <SwipeAction label="Delete account" onActivate={confirmDelete} disabled={saving} />
        <View style={styles.footer}>
          <SwipeAction label="Dashboard" onActivate={onBack} />
          <GestureDetector gesture={logoutGesture}>
            <Animated.View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Log out"
              accessibilityHint="Swipe right or activate to log out."
              accessibilityState={{ disabled: saving }}
              accessibilityActions={[{ name: "activate", label: "Log out" }]}
              onAccessibilityAction={(event) => {
                if (!saving && event.nativeEvent.actionName === "activate") void logout();
              }}
              onAccessibilityTap={() => { if (!saving) void logout(); }}
              style={logoutStyle}
            >
              <Text style={styles.logoutText}>Logout.</Text>
              <Text style={styles.logoutHint}>Swipe right to logout →</Text>
            </Animated.View>
          </GestureDetector>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  keyboard: { flex: 1 },
  content: { padding: 28, paddingTop: 72, paddingBottom: 56 },
  eyebrow: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  identity: { alignItems: "flex-start", gap: 18, marginTop: 28 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  avatar: {
    width: 136,
    height: 136,
    borderWidth: 2,
    backgroundColor: colors.bgDark2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: "100%", height: "100%", opacity: 0.9 },
  avatarInitial: { color: colors.white, fontSize: 64, fontWeight: "900" },
  photoEdit: {
    minWidth: 132,
    borderWidth: 1,
    borderColor: colors.white20,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  photoEditText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  photoOptions: {
    width: "100%",
    padding: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 14,
  },
  photoOptionsTitle: {
    color: colors.white50,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  photoChoices: {
    flexDirection: "row",
    gap: 12,
  },
  photoChoice: {
    flex: 1,
    gap: 8,
  },
  choiceImage: {
    width: "100%",
    height: 110,
    borderRadius: 14,
  },
  choiceLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nameText: {
    color: colors.white,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
  },
  nameEditor: { width: "100%", gap: 12 },
  nameInput: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "800",
    borderBottomWidth: 1,
    borderBottomColor: colors.white30,
    paddingVertical: 8,
  },
  saveText: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  editBadge: {
    borderWidth: 1,
    borderColor: colors.white20,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBadgeText: {
    color: colors.white50,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  editNameText: {
    color: colors.white50,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  emailBlock: { width: "100%", marginTop: 12, gap: 8 },
  emailLabel: {
    color: colors.white40,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  emailRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  emailText: { color: colors.white, fontSize: 14, flex: 1 },
  editEmailText: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  emailEditor: { width: "100%", gap: 10 },
  emailInput: {
    color: colors.white,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.white30,
    paddingVertical: 8,
  },
  emailActions: { flexDirection: "row", gap: 20, alignItems: "center" },
  cancelText: {
    color: colors.white40,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  message: { color: colors.rose, fontSize: 12, lineHeight: 18, marginTop: 20 },
  sectionList: { marginTop: 58, gap: 18 },
  aiAgreement: { gap: 12, marginTop: 12 },
  sectionItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.white10,
    paddingBottom: 16,
  },
  sectionButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  sectionMark: { color: colors.white50, fontSize: 24, fontWeight: "300" },
  sectionContent: {
    color: colors.white50,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 330,
  },
  supportLink: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 12,
    textTransform: "uppercase",
  },
  deleteReauthOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  deleteReauthContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  deleteReauthPanel: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.white20,
    padding: 22,
  },
  deleteReauthTitle: { color: colors.white, fontSize: 24, fontWeight: "800" },
  deleteReauthText: {
    color: colors.white50,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  deletePasswordInput: {
    color: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.white20,
    paddingVertical: 12,
    marginTop: 18,
  },
  deleteReauthActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  deleteButton: { marginTop: 52, paddingVertical: 12 },
  deleteText: {
    color: colors.rose,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
  },
  footerLink: { color: colors.white50, fontSize: 16, fontWeight: "600" },
  logoutText: { color: colors.rose, fontSize: 16, fontWeight: "700" },
  logoutHint: {
    color: colors.white40,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 5,
    textTransform: "uppercase",
  },
});
