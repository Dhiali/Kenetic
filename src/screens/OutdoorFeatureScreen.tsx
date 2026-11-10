import {
    CameraView,
    useCameraPermissions,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { File } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    cancelAnimation,
    Easing,
    FadeIn,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    finishBioRadarSession,
    persistOutdoorFeatureLaunch,
    persistOutdoorScan,
    startBioRadarSession,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { capitalizeSentenceStarts } from "../utils/sentenceCase";
import SwipeAction from "../components/SwipeAction";
import AiConsent from "../components/AiConsent";
import { useAiConsent } from "../lib/ai/useAiConsent";
import { analyzeNature, type NatureResult } from "../lib/ai/client";
import DailyChallengesScreen from "./DailyChallengesScreen";
import SpotFinderScreen from "./SpotFinderScreen";
import CuriosityQuizScreen from "./CuriosityQuizScreen";

export type OutdoorFeature =
  | "bio-radar"
  | "quizzes"
  | "spot-finder"
  | "daily-challenges";

type Props = { feature: OutdoorFeature; onBack: () => void };
type BioPhase = "live" | "processing" | "dossier";
type ActiveBioSession = { id: string; startedAtMs: number; mode: "visual" };

export default function OutdoorFeatureScreen({ feature, onBack }: Props) {
  if (feature === "bio-radar") return <BioRadarExperience onBack={onBack} />;
  if (feature === "quizzes") return <CuriosityQuizScreen onBack={onBack} />;
  if (feature === "daily-challenges") return <DailyChallengesScreen onBack={onBack} />;
  return <SpotFinderScreen onBack={onBack} />;
}

function BioRadarExperience({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const cameraPermissionHook = useCameraPermissions();
  const cameraPermission = Array.isArray(cameraPermissionHook)
    ? cameraPermissionHook[0]
    : null;
  const requestCameraPermission = Array.isArray(cameraPermissionHook)
    ? cameraPermissionHook[1]
    : async () => null;
  const cameraReference = useRef<CameraView | null>(null);

  const holdHumInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const telemetryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSessionReference = useRef<ActiveBioSession | null>(null);
  const processingRef = useRef(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const photoRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<BioPhase>("live");
  const [discovery, setDiscovery] = useState<NatureResult | null>(null);
  const aiConsent = useAiConsent();
  const [frozenUri, setFrozenUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveBioSession | null>(
    null,
  );

  const holdProgress = useSharedValue(0);
  const auraRotate = useSharedValue(0);
  const auraPulse = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exitX = useSharedValue(0);

  useEffect(() => {
    mountedRef.current = true;
    auraRotate.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    auraPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => {
      mountedRef.current = false;
      if (photoRef.current) {
        try { new File(photoRef.current).delete(); }
        catch (cleanupError) { console.error("Could not remove temporary photo", cleanupError); }
      }
      if (holdHumInterval.current) clearInterval(holdHumInterval.current);
      if (telemetryTimer.current) clearInterval(telemetryTimer.current);
      const session = activeSessionReference.current;
      if (session) {
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - session.startedAtMs) / 1000),
        );
        void finishBioRadarSession(session.id, durationSeconds, false, {
          scanMode: session.mode,
          reason: "view-unmounted",
        }).catch((cleanupError) => console.error("Could not close Bio Radar session", cleanupError));
        activeSessionReference.current = null;
      }
    };
  }, [auraPulse, auraRotate]);

  useEffect(() => {
    activeSessionReference.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    void persistOutdoorFeatureLaunch("bio-radar").catch(() => undefined);
  }, []);

  const triggerLight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  };
  const triggerMedium = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );
  };
  const triggerHeavy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
      () => undefined,
    );
  };
  const triggerError = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => undefined,
    );
  };

  const clearHold = () => {
    if (holdHumInterval.current) clearInterval(holdHumInterval.current);
    holdHumInterval.current = null;
    cancelAnimation(holdProgress);
    holdProgress.value = withTiming(0, { duration: 160 });
  };

  const setSessionState = (session: ActiveBioSession | null) => {
    activeSessionReference.current = session;
    setActiveSession(session);
  };

  const closeActiveSession = async (reason: string) => {
    const session = activeSessionReference.current;
    if (!session) return;
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - session.startedAtMs) / 1000),
    );
    await finishBioRadarSession(session.id, durationSeconds, false, {
      scanMode: session.mode,
      reason,
    });
    setSessionState(null);
  };

  const handleBackFromBioRadar = async () => {
    if (processingRef.current) {
      setError("Please wait for the current scan to finish.");
      return;
    }
    clearHold();
    try {
      await closeActiveSession("user-exit");
      onBack();
    } catch (caught) {
      setError(`Could not close the session: ${firebaseErrorMessage(caught)}`);
    }
  };

  const beginHoldHum = () => {
    if (holdHumInterval.current) clearInterval(holdHumInterval.current);
    const start = Date.now();
    holdHumInterval.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 1000) triggerLight();
      else triggerMedium();
    }, 180);
  };

  const beginProcessing = async () => {
    if (phase !== "live" || aiConsent.status !== "agreed" || processingRef.current) return;
    if (saving) return;
    if (!cameraPermission?.granted) {
      clearHold();
      triggerError();
      setError("Grant camera permission to start a photo scan.");
      return;
    }
    clearHold();
    setError("");
    setNotice("");
    processingRef.current = true;

    const sessionId = await startBioRadarSession("visual").catch((caught) => {
      triggerError();
      setError(firebaseErrorMessage(caught));
      return null;
    });
    if (!sessionId) { processingRef.current = false; return; }
    if (!mountedRef.current) {
      processingRef.current = false;
      try { await finishBioRadarSession(sessionId, 0, false, { scanMode: "visual", reason: "view-unmounted" }); }
      catch (cleanupError) { console.error("Could not close Bio Radar session", cleanupError); }
      return;
    }

    setSessionState({ id: sessionId, startedAtMs: Date.now(), mode: "visual" });
    setTelemetryIndex(0);
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );

    let mediaUri: string | null = null;
    let succeeded = false;
    try {
      const picture = await cameraReference.current?.takePictureAsync({ quality: 0.35 });
      if (!picture?.uri) throw new Error("Could not capture a photo. Please try again.");
      mediaUri = picture.uri;
      photoRef.current = mediaUri;
      setFrozenUri(mediaUri);
      setPhase("processing");
      telemetryTimer.current = setInterval(() => setTelemetryIndex((current) => (current + 1) % 3), 800);
      if (!mountedRef.current) return;
      const result = await analyzeNature(mediaUri);
      if (!mountedRef.current) return;
      setDiscovery(result);
      setPhase("dossier");
      succeeded = true;
      triggerHeavy();
    } catch (caught) {
      if (mountedRef.current) {
        setError(firebaseErrorMessage(caught));
        setPhase("live");
        void aiConsent.refresh();
        setFrozenUri(null);
        try { await closeActiveSession("scan-failed"); }
        catch (finishError) { setError(`${firebaseErrorMessage(caught)} Session cleanup failed: ${firebaseErrorMessage(finishError)}`); }
      }
    } finally {
      if (mediaUri && (!succeeded || !mountedRef.current)) {
        try {
          new File(mediaUri).delete();
          if (photoRef.current === mediaUri) photoRef.current = null;
        }
        catch (cleanupError) { if (mountedRef.current) setError(`Could not remove temporary media: ${firebaseErrorMessage(cleanupError)}`); }
      }
      if (telemetryTimer.current) clearInterval(telemetryTimer.current);
      telemetryTimer.current = null;
      processingRef.current = false;
    }
  };

  const onReticlePressIn = () => {
    if (phase !== "live") return;
    holdProgress.value = withTiming(
      1,
      { duration: 2000, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(beginProcessing)();
      },
    );
    beginHoldHum();
  };

  const onReticlePressOut = () => {
    if (phase === "live") clearHold();
  };

  const commitDiscovery = async () => {
    if (savingRef.current || !discovery) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const session = activeSessionReference.current;
    const sessionId = session?.id;
    const durationSeconds = session
      ? Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000))
      : 1;
    let scanSaved = false;
    try {
      await persistOutdoorScan({
        source: "camera",
        title: discovery.name,
        scientificName: discovery.scientificName,
        summary: `${discovery.summary} ${discovery.uncertainty}`,
        includeInDailyQuizzes: true,
        mode: "visual",
        engine: "gemini-v1",
        ...(sessionId ? { scanSessionId: sessionId } : {}),
      });
      scanSaved = true;

      if (sessionId) {
        await finishBioRadarSession(sessionId, durationSeconds, true, {
          scanMode: "visual",
          species: discovery.name,
          includeInDailyQuizzes: true,
        });
      }

      setSessionState(null);
      triggerHeavy();
      if (frozenUri) {
        try { new File(frozenUri).delete(); photoRef.current = null; }
        catch (cleanupError) { console.error("Could not remove temporary photo", cleanupError); }
      }
      setDiscovery(null);
      void aiConsent.refresh();
      setPhase("live");
      setNotice("Discovery saved. You can scan something else whenever you're ready.");
      setFrozenUri(null);
      holdProgress.value = 0;
    } catch (caught) {
      if (scanSaved) {
        if (frozenUri) {
          try { new File(frozenUri).delete(); photoRef.current = null; }
          catch (cleanupError) { console.error("Could not remove temporary photo", cleanupError); }
        }
        setSessionState(null);
        triggerHeavy();
        setDiscovery(null);
        void aiConsent.refresh();
        setPhase("live");
        setFrozenUri(null);
        holdProgress.value = 0;
        setError(
          "Discovery saved, but its session analytics could not be finalized.",
        );
      } else {
        triggerError();
        setError(firebaseErrorMessage(caught));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const exitGesture = Gesture.Pan()
    .activeOffsetX(10)
    .onUpdate((event) => {
      if (event.translationX > 0) exitX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > 90) runOnJS(handleBackFromBioRadar)();
      else exitX.value = withSpring(0);
    });

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: exitX.value }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${auraRotate.value}deg` },
      { scale: interpolate(auraPulse.value, [0, 1], [0.95, 1.08]) },
    ],
    opacity: interpolate(holdProgress.value, [0, 1], [0.55, 0.95]),
  }));

  const reticleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(holdProgress.value, [0, 1], [1, 1.14]) }],
    borderColor: "#22c55e",
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-260, 260]) }],
  }));

  const telemetryLines = [
    "Preparing your photo...",
    "Asking Gemini...",
    "Results may be uncertain",
  ];

  const showCamera = phase === "live" && aiConsent.status === "agreed";
  const requestCameraAccess = async () => {
    setError("");
    try {
      if (cameraPermission && !cameraPermission.canAskAgain && !cameraPermission.granted) {
        await Linking.openSettings();
      } else {
        await requestCameraPermission();
      }
    } catch (caught) {
      setError(`Could not open camera permission settings: ${firebaseErrorMessage(caught)}`);
    }
  };

  return (
    <Animated.View
      style={[styles.bioRoot, rootStyle]}
      entering={FadeIn.duration(420)}
    >
      {showCamera && cameraPermission?.granted ? (
        <CameraView
          ref={cameraReference}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
      ) : frozenUri ? (
        <Image
          source={{ uri: frozenUri }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.bioFallback} />
      )}

      <View pointerEvents="none" style={styles.bioOverlay} />

      {phase !== "dossier" && (
        <GestureDetector gesture={exitGesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Return to outdoors"
            accessibilityHint="Drag right, or activate to return."
            accessibilityActions={[{ name: "activate", label: "Return to outdoors" }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "activate") void handleBackFromBioRadar();
            }}
            onAccessibilityTap={() => void handleBackFromBioRadar()}
            style={[styles.bioNavRow, { top: insets.top + 52 }]}
          >
            <Text style={styles.bioBack}>Outdoors →</Text>
            <Text style={styles.bioHint}>(Drag right to return)</Text>
          </View>
        </GestureDetector>
      )}

      {phase === "live" && aiConsent.status !== "agreed" && (
        <ScrollView style={[styles.bioScroll, { top: insets.top + 110 }]} contentContainerStyle={[styles.bioContent, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.bioEyebrow}>OUTDOORS / BIO RADAR</Text>
          <Text style={styles.bioTitle}>Look closer.</Text>
          <Text style={styles.bioIntro}>Explore what you find in nature, one photo at a time.</Text>
          <View style={styles.bioInfoCard}>
          <Text style={styles.bioCardLabel}>BEFORE YOU SCAN</Text>
          {aiConsent.status === "loading" && <Text style={styles.bioBody}>Checking your AI agreement...</Text>}
          {aiConsent.status === "not-agreed" && (
            <AiConsent disabled={aiConsent.saving} onAgree={() => void aiConsent.change(true)} />
          )}
          {!!aiConsent.error && <Text accessibilityLiveRegion="polite" style={styles.error}>{aiConsent.error}</Text>}
          {aiConsent.status === "error" && <SwipeAction label="Retry checking AI agreement" onActivate={() => void aiConsent.refresh()} />}
          {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          </View>
        </ScrollView>
      )}
      {phase === "live" && aiConsent.status === "agreed" && (
        <ScrollView style={[styles.bioScroll, { top: insets.top + 110 }]} contentContainerStyle={[styles.bioContent, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.bioEyebrow}>OUTDOORS / BIO RADAR</Text>
          <Text style={styles.bioTitle}>Look closer.</Text>
          <Text style={styles.bioIntro}>Find something in nature and bring it into view.</Text>
          <View style={styles.scanArea}>
          {cameraPermission?.granted ? (
            <Pressable
              onPressIn={onReticlePressIn}
              onPressOut={onReticlePressOut}
              accessibilityRole="button"
              accessibilityLabel="Start nature discovery"
              accessibilityHint="Hold for two seconds to capture and send a photo to Gemini, or use the activate accessibility action."
              accessibilityActions={[{ name: "activate", label: "Start discovery" }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === "activate") void beginProcessing();
              }}
            >
              <Animated.View style={[styles.reticleAura, auraStyle]}>
                <LinearGradient
                  colors={["rgba(22,163,74,0.75)", "rgba(34,197,94,0.15)", "rgba(34,197,94,0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View style={[styles.reticleRing, reticleStyle]}>
                <Text style={styles.reticleText}>HOLD 2 SEC</Text>
                <Text style={styles.reticleSubtext}>to scan</Text>
              </Animated.View>
            </Pressable>
          ) : cameraPermission ? (
            <View style={styles.permissionCard}>
              <Text style={styles.bioCardLabel}>CAMERA ACCESS</Text>
              <Text style={styles.bioBody}>Allow camera access to photograph a discovery.</Text>
              <SwipeAction label={cameraPermission.canAskAgain ? "Allow camera access" : "Open camera settings"} onActivate={() => void requestCameraAccess()} />
            </View>
          ) : (
            <Text style={styles.bioBody}>Checking camera permission...</Text>
          )}
          </View>
          <View style={styles.bioInfoCard}>
            <Text style={styles.bioCardLabel}>BEFORE YOU SCAN</Text>
            <Text style={styles.bioBody}>Your photo is sent to Gemini. Avoid people and private information. Results are estimates, not safety advice.</Text>
          </View>
          {!!notice && <Text accessibilityLiveRegion="polite" style={styles.bioNotice}>{notice}</Text>}
          {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        </ScrollView>
      )}

      {phase === "processing" && (
        <View style={styles.processingLayer}>
          <Animated.View style={[styles.sonarSweep, sweepStyle]} />
          <View style={styles.processingCard}>
            <Text style={styles.bioCardLabel}>BIO RADAR / ANALYZING</Text>
            <Text style={styles.processingTitle}>Taking a closer look.</Text>
            <Text accessibilityLiveRegion="polite" style={styles.bioBody}>{telemetryLines[telemetryIndex]}</Text>
            <Text style={styles.processingNote}>Please keep Kenetic open while your photo is analyzed.</Text>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      {phase === "dossier" && discovery && (
        <View style={styles.dossierSheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.bioEyebrow}>BIO RADAR / POSSIBLE DISCOVERY</Text>
          <Text style={styles.dossierTitle}>{capitalizeSentenceStarts(discovery.name)}</Text>
          <Text style={styles.dossierSubtitle}>{discovery.scientificName}</Text>
          <View style={styles.dossierCard}>
            <Text style={styles.bioCardLabel}>ABOUT THIS DISCOVERY</Text>
            <Text style={styles.dossierRow}>{capitalizeSentenceStarts(discovery.summary)}</Text>
          </View>
          <View style={styles.dossierCard}>
            <Text style={styles.bioCardLabel}>WHAT TO KEEP IN MIND</Text>
            <Text style={styles.dossierRow}>{capitalizeSentenceStarts(discovery.uncertainty)}</Text>
          </View>
          <Text style={styles.matchText}>AI estimate only. Do not use for eating, handling or safety decisions.</Text>
          <Text style={styles.dossierNote}>Saving keeps the AI result, not the photo. Quizzes may ask what this result said; it is not a verified identification.</Text>
          <SwipeAction label={saving ? "Saving discovery" : "Save discovery"} disabled={saving} onActivate={() => void commitDiscovery()} />

          {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          </ScrollView>
        </View>
      )}

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  error: { color: "#fca5a5", marginTop: 16, lineHeight: 20 },
  bioRoot: { flex: 1, backgroundColor: "#090909" },
  bioFallback: { flex: 1, backgroundColor: "#0f1110" },
  bioOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6,7,6,0.56)",
  },
  bioNavRow: {
    position: "absolute",
    left: 28,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  bioBack: { color: "#f8fafc", fontSize: 14, fontWeight: "700" },
  bioHint: { color: "rgba(255,255,255,0.44)", fontSize: 12 },
  bioScroll: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 9 },
  bioContent: { paddingHorizontal: 28, paddingTop: 16 },
  bioEyebrow: { color: "#a5e9bb", fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  bioTitle: { color: "#fff", fontSize: 48, lineHeight: 52, fontWeight: "900", letterSpacing: -2, marginTop: 12 },
  bioIntro: { color: "#e1eee4", fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 330 },
  bioInfoCard: { backgroundColor: "rgba(16, 33, 22, 0.94)", borderWidth: 1, borderColor: "#3d6c4d", borderRadius: 20, padding: 18, marginTop: 20 },
  bioCardLabel: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  bioBody: { color: "#e2eee5", fontSize: 14, lineHeight: 21, marginTop: 10 },
  bioNotice: { color: "#c5f2d1", fontSize: 14, lineHeight: 21, marginTop: 18 },
  scanArea: {
    minHeight: 270,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  permissionCard: {
    width: "100%",
    backgroundColor: "rgba(16, 33, 22, 0.94)",
    borderWidth: 1,
    borderColor: "#3d6c4d",
    borderRadius: 20,
    padding: 20,
  },
  reticleAura: {
    width: 260,
    height: 260,
    borderRadius: 140,
    overflow: "hidden",
  },
  reticleRing: {
    position: "absolute",
    top: 60,
    left: 60,
    width: 140,
    height: 140,
    borderRadius: 80,
    borderWidth: 2,
    backgroundColor: "rgba(9,24,14,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  reticleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  reticleSubtext: { color: "#c5e1cd", fontSize: 12, marginTop: 4 },
  processingLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 8,
  },
  sonarSweep: {
    position: "absolute",
    width: "100%",
    height: 220,
    backgroundColor: "rgba(74,222,128,0.16)",
  },
  processingCard: { width: "85%", maxWidth: 360, backgroundColor: "#102116", borderWidth: 1, borderColor: "#3d6c4d", borderRadius: 24, padding: 24 },
  processingTitle: { color: "#fff", fontSize: 32, lineHeight: 37, fontWeight: "900", letterSpacing: -1, marginTop: 15 },
  processingNote: { color: "#b9d1c0", fontSize: 12, lineHeight: 18, marginTop: 18 },
  dossierSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "85%",
    backgroundColor: "#0b160f",
    borderTopWidth: 1,
    borderTopColor: "#437853",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 20,
    zIndex: 11,
  },
  dossierCard: { backgroundColor: "#14271b", borderWidth: 1, borderColor: "#315c3f", borderRadius: 18, padding: 18, marginTop: 12 },
  dossierTitle: {
    color: "#fff",
    fontSize: 46,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
    marginTop: 12,
  },
  dossierSubtitle: {
    color: "#bed7c5",
    fontSize: 17,
    fontStyle: "italic",
    marginTop: 6,
    marginBottom: 16,
  },
  dossierRow: {
    color: "#e2eee5",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  matchText: {
    color: "#f1e4be",
    backgroundColor: "#373322",
    borderLeftWidth: 3,
    borderLeftColor: "#dfc877",
    borderRadius: 8,
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  dossierNote: { color: "#bdcfc2", fontSize: 13, lineHeight: 20, marginTop: 16 },
});
