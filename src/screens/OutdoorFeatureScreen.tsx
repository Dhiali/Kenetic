import {
    CameraView,
    useCameraPermissions,
    useMicrophonePermissions,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
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
    persistOutdoorQuizResult,
    persistOutdoorScan,
    startBioRadarSession,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";

export type OutdoorFeature =
  | "bio-radar"
  | "quizzes"
  | "spot-finder"
  | "daily-challenges";

type Props = { feature: OutdoorFeature; onBack: () => void };
type BioMode = "visual" | "acoustic";
type BioPhase = "live" | "processing" | "dossier";
type ActiveBioSession = { id: string; startedAtMs: number; mode: BioMode };

type Species = {
  commonName: string;
  scientificName: string;
  origin: string;
  role: string;
  fact: string;
  somaticPrompt: string;
};

const SPECIES_LIBRARY: Species[] = [
  {
    commonName: "EUROPEAN ROBIN",
    scientificName: "Erithacus rubecula",
    origin: "Native to Europe, Western Siberia, and North Africa.",
    role: "Key seed disperser and soil ecosystem indicator.",
    fact: "Navigates using a magnetic compass in its eye sensitive to blue light.",
    somaticPrompt:
      "Listen for 30 seconds. Try to isolate this bird call from background wind.",
  },
  {
    commonName: "COMMON OAK",
    scientificName: "Quercus robur",
    origin: "Native across most of Europe and temperate western Asia.",
    role: "Supports hundreds of insect species and stabilizes forest soils.",
    fact: "An old oak can host more biodiversity than a young mixed woodland patch.",
    somaticPrompt:
      "Place your palm on bark for 20 seconds and track breath lengthening.",
  },
  {
    commonName: "RED FOX",
    scientificName: "Vulpes vulpes",
    origin: "Widely distributed across Europe, Asia, and North Africa.",
    role: "Balances rodent populations and supports trophic stability.",
    fact: "Uses the Earth's magnetic field as an aiming aid while hunting.",
    somaticPrompt:
      "Walk 12 slow steps and listen for the quietest sound you can detect.",
  },
];

const QUIZ_QUESTIONS = [
  {
    prompt: "Why do mosses thrive on the shaded side of a tree?",
    answer:
      "They retain moisture more easily where direct sun and wind are reduced.",
  },
  {
    prompt: "What does a mixed woodland canopy provide?",
    answer: "Different layers of food and shelter for many species.",
  },
  {
    prompt: "Why leave fallen logs on the forest floor?",
    answer:
      "They return nutrients and create habitat for insects, fungi, and small animals.",
  },
];

export default function OutdoorFeatureScreen({ feature, onBack }: Props) {
  if (feature === "bio-radar") return <BioRadarExperience onBack={onBack} />;

  const exitX = useSharedValue(0);
  const exit = Gesture.Pan()
    .activeOffsetX(10)
    .onUpdate((event) => {
      if (event.translationX > 0) exitX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > 90) runOnJS(onBack)();
      else exitX.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: exitX.value }],
  }));

  return (
    <GestureDetector gesture={exit}>
      <Animated.View
        style={[styles.screen, style]}
        entering={FadeIn.duration(360)}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>&lt;- outdoors</Text>
          </Pressable>
          <Text style={styles.eyebrow}>{feature.replace("-", " ")}</Text>
          {feature === "quizzes" && <Quizzes />}
          {feature === "spot-finder" && (
            <ComingSoonFeature title="spot finder." />
          )}
          {feature === "daily-challenges" && (
            <ComingSoonFeature title="daily challenges." />
          )}
        </ScrollView>
      </Animated.View>
    </GestureDetector>
  );
}

function BioRadarExperience({ onBack }: { onBack: () => void }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();
  const cameraReference = useRef<CameraView | null>(null);

  const holdHumInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSessionReference = useRef<ActiveBioSession | null>(null);

  const [mode, setMode] = useState<BioMode>("visual");
  const [phase, setPhase] = useState<BioPhase>("live");
  const [scanSeed, setScanSeed] = useState(0);
  const [frozenUri, setFrozenUri] = useState<string | null>(null);
  const [includeQuiz, setIncludeQuiz] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveBioSession | null>(
    null,
  );

  const holdProgress = useSharedValue(0);
  const auraRotate = useSharedValue(0);
  const auraPulse = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exitX = useSharedValue(0);

  const yesX = useSharedValue(0);
  const yesY = useSharedValue(0);
  const discoveredX = useSharedValue(0);
  const discoveredY = useSharedValue(0);

  const discovery = useMemo(() => {
    const index = Math.abs(scanSeed) % SPECIES_LIBRARY.length;
    return SPECIES_LIBRARY[index];
  }, [scanSeed]);

  const matchScore = 95 + (scanSeed % 4);

  useEffect(() => {
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
      if (holdHumInterval.current) clearInterval(holdHumInterval.current);
      if (processingTimer.current) clearTimeout(processingTimer.current);
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
        });
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
    setSessionState(null);
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - session.startedAtMs) / 1000),
    );
    await finishBioRadarSession(session.id, durationSeconds, false, {
      scanMode: session.mode,
      reason,
    });
  };

  const handleBackFromBioRadar = () => {
    clearHold();
    void closeActiveSession("user-exit").catch(() => undefined);
    onBack();
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

  const finishProcessing = () => {
    if (telemetryTimer.current) clearInterval(telemetryTimer.current);
    telemetryTimer.current = null;
    setPhase("dossier");
    triggerHeavy();
  };

  const beginProcessing = async () => {
    if (phase !== "live") return;
    if (saving) return;
    const permissionReady =
      mode === "visual"
        ? cameraPermission?.granted
        : microphonePermission?.granted;
    if (!permissionReady) {
      clearHold();
      triggerError();
      setError(
        mode === "visual"
          ? "Grant camera permission to start a visual scan."
          : "Grant microphone permission to start an acoustic scan.",
      );
      return;
    }
    clearHold();
    setError("");
    setIncludeQuiz(false);

    const sessionId = await startBioRadarSession(mode).catch((caught) => {
      triggerError();
      setError(firebaseErrorMessage(caught));
      return null;
    });
    if (!sessionId) return;

    setSessionState({ id: sessionId, startedAtMs: Date.now(), mode });
    setPhase("processing");
    setTelemetryIndex(0);
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );

    if (mode === "visual") {
      const picture = await cameraReference.current
        ?.takePictureAsync({ quality: 0.35, skipProcessing: true })
        .catch(() => null);
      setFrozenUri(picture?.uri ?? null);
    } else {
      setFrozenUri(null);
    }

    telemetryTimer.current = setInterval(() => {
      setTelemetryIndex((current) => (current + 1) % 3);
      triggerLight();
    }, 420);

    processingTimer.current = setTimeout(finishProcessing, 2300);
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

  const activateMode = (nextMode: BioMode) => {
    if (phase !== "live") return;
    setMode(nextMode);
    if (nextMode === "visual") void requestCameraPermission();
    if (nextMode === "acoustic") void requestMicrophonePermission();
    triggerLight();
  };

  const modeGesture = Gesture.Pan().onEnd((event) => {
    if (event.translationX < -30) runOnJS(activateMode)("acoustic");
    if (event.translationX > 30) runOnJS(activateMode)("visual");
  });

  const yesGesture = Gesture.Pan()
    .enabled(!includeQuiz)
    .onBegin(() => {
      runOnJS(triggerLight)();
    })
    .onUpdate((event) => {
      if (includeQuiz) return;
      yesX.value = event.translationX;
      yesY.value = event.translationY;
    })
    .onEnd(() => {
      if (includeQuiz) return;
      if (yesX.value > 55 && Math.abs(yesY.value) < 60) {
        runOnJS(setIncludeQuiz)(true);
        yesX.value = withSpring(0, { damping: 14, stiffness: 240 });
        yesY.value = withSpring(0, { damping: 14, stiffness: 240 });
        runOnJS(triggerMedium)();
        return;
      }
      yesX.value = withSpring(0);
      yesY.value = withSpring(0);
    });

  const commitDiscovery = async () => {
    if (saving) return;
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
        source: mode === "visual" ? "camera" : "microphone",
        title: discovery.commonName,
        scientificName: discovery.scientificName,
        summary: `Origin: ${discovery.origin} Eco-role: ${discovery.role}`,
        ecologicalSignificance: discovery.fact,
        somaticPrompt: discovery.somaticPrompt,
        includeInDailyQuizzes: includeQuiz,
        mode,
        engine: "deterministic-v1",
        ...(sessionId ? { scanSessionId: sessionId } : {}),
        matchScore,
        ...(frozenUri ? { capturedAssetUri: frozenUri } : {}),
      });
      scanSaved = true;

      if (sessionId) {
        await finishBioRadarSession(sessionId, durationSeconds, true, {
          scanMode: mode,
          species: discovery.commonName,
          includeInDailyQuizzes: includeQuiz,
          matchScore,
        });
      }

      setSessionState(null);
      triggerHeavy();
      setScanSeed((value) => value + 1);
      setPhase("live");
      setFrozenUri(null);
      yesX.value = 0;
      yesY.value = 0;
      discoveredX.value = 0;
      discoveredY.value = 0;
      holdProgress.value = 0;
    } catch (caught) {
      if (scanSaved) {
        setSessionState(null);
        triggerHeavy();
        setScanSeed((value) => value + 1);
        setPhase("live");
        setFrozenUri(null);
        yesX.value = 0;
        yesY.value = 0;
        discoveredX.value = 0;
        discoveredY.value = 0;
        holdProgress.value = 0;
        setError(
          "Discovery saved. Session analytics could not be finalized; retrying on your next scan.",
        );
      } else {
        triggerError();
        setError(firebaseErrorMessage(caught));
      }
    } finally {
      setSaving(false);
    }
  };

  const discoveredGesture = Gesture.Pan()
    .enabled(!saving)
    .onBegin(() => {
      runOnJS(triggerLight)();
    })
    .onUpdate((event) => {
      if (saving) return;
      discoveredX.value = event.translationX;
      discoveredY.value = event.translationY;
    })
    .onEnd(() => {
      if (saving) return;
      if (discoveredX.value > 65 && Math.abs(discoveredY.value) < 60) {
        discoveredX.value = withSpring(0, { damping: 14, stiffness: 240 });
        discoveredY.value = withSpring(0, { damping: 14, stiffness: 240 });
        runOnJS(commitDiscovery)();
        return;
      }
      discoveredX.value = withSpring(0);
      discoveredY.value = withSpring(0);
    });

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
    borderColor: mode === "visual" ? "#22c55e" : "#fb923c",
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-260, 260]) }],
  }));

  const yesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: yesX.value }, { translateY: yesY.value }],
  }));

  const discoveredStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: discoveredX.value },
      { translateY: discoveredY.value },
    ],
    opacity: saving ? 0.55 : 1,
  }));

  const telemetryLines = [
    "analyzing cellular structure...",
    "matching acoustic frequency...",
    `${matchScore}.0% biological match score`,
  ];

  const showCamera = phase === "live" && mode === "visual";

  return (
    <Animated.View
      style={[styles.bioRoot, rootStyle]}
      entering={FadeIn.duration(420)}
    >
      {showCamera && cameraPermission?.granted ? (
        <CameraView
          ref={cameraReference}
          style={StyleSheet.absoluteFillObject}
          facing="back"
        />
      ) : frozenUri ? (
        <Image
          source={{ uri: frozenUri }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={styles.bioFallback} />
      )}

      <View style={styles.bioOverlay} />
      <View style={styles.gridOverlay} />

      <GestureDetector gesture={exitGesture}>
        <View style={styles.bioNavRow}>
          <Text style={styles.bioBack}>&lt;- outdoors state</Text>
          <Text style={styles.bioHint}>(drag right to return)</Text>
        </View>
      </GestureDetector>

      {phase === "live" && (
        <View style={styles.reticleLayer}>
          {showCamera && !cameraPermission?.granted && (
            <Pressable
              onPress={() => void requestCameraPermission()}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionText}>grant camera permission</Text>
            </Pressable>
          )}
          {mode === "acoustic" && !microphonePermission?.granted && (
            <Pressable
              onPress={() => void requestMicrophonePermission()}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionText}>
                grant microphone permission
              </Text>
            </Pressable>
          )}

          <Pressable
            onPressIn={onReticlePressIn}
            onPressOut={onReticlePressOut}
          >
            <Animated.View style={[styles.reticleAura, auraStyle]}>
              <LinearGradient
                colors={
                  mode === "visual"
                    ? [
                        "rgba(22,163,74,0.75)",
                        "rgba(34,197,94,0.15)",
                        "rgba(34,197,94,0)",
                      ]
                    : [
                        "rgba(249,115,22,0.75)",
                        "rgba(251,146,60,0.15)",
                        "rgba(251,146,60,0)",
                      ]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
            <Animated.View style={[styles.reticleRing, reticleStyle]}>
              <Text style={styles.reticleText}>hold 2s to scan</Text>
            </Animated.View>
          </Pressable>
        </View>
      )}

      {phase === "processing" && (
        <View style={styles.processingLayer}>
          <Animated.View style={[styles.sonarSweep, sweepStyle]} />
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetry}>
              {telemetryLines[telemetryIndex]}
            </Text>
            <Text style={styles.telemetry}>
              {telemetryLines[(telemetryIndex + 1) % 3]}
            </Text>
            <Text style={styles.telemetry}>
              {telemetryLines[(telemetryIndex + 2) % 3]}
            </Text>
          </View>
        </View>
      )}

      {phase === "dossier" && (
        <View style={styles.dossierSheet}>
          <View style={styles.dossierBlob} />
          <Text style={styles.dossierTitle}>{discovery.commonName}</Text>
          <Text style={styles.dossierSubtitle}>{discovery.scientificName}</Text>

          <Text style={styles.dossierRow}>ORIGIN | {discovery.origin}</Text>
          <Text style={styles.dossierRow}>ECO-ROLE | {discovery.role}</Text>
          <Text style={styles.dossierRow}>
            CURIOSITY FACT | {discovery.fact}
          </Text>
          <Text style={styles.matchText}>MATCH SCORE | {matchScore}.0%</Text>

          <View style={styles.quizRitualRow}>
            <Text style={styles.quizLabel}>include in daily quizzes?</Text>
            <View style={styles.quizWordWrap}>
              <GestureDetector gesture={yesGesture}>
                <Animated.Text
                  style={[
                    styles.quizWordActive,
                    yesStyle,
                    includeQuiz ? styles.quizWordActiveSnapped : null,
                  ]}
                >
                  yes
                </Animated.Text>
              </GestureDetector>
              <Text style={styles.quizWordTarget}>yes</Text>
            </View>
          </View>

          <View style={styles.discoveredRow}>
            <Text style={styles.discoveredLabel}>drag and drop to save</Text>
            <View style={styles.discoveredWordWrap}>
              <GestureDetector gesture={discoveredGesture}>
                <Animated.Text
                  style={[
                    styles.discoveredWordActive,
                    discoveredStyle,
                    saving ? styles.discoveredWordSaving : null,
                  ]}
                >
                  {saving ? "saving..." : "discovered"}
                </Animated.Text>
              </GestureDetector>
              <Text style={styles.discoveredTarget}>discovered</Text>
            </View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      <GestureDetector gesture={modeGesture}>
        <View style={styles.modeSelector} />
      </GestureDetector>
    </Animated.View>
  );
}

function Quizzes() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const next = () => {
    setIndex((index + 1) % QUIZ_QUESTIONS.length);
    setRevealed(false);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const question = QUIZ_QUESTIONS[index];

  const submitResult = async (correct: boolean) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await persistOutdoorQuizResult({
        questionId: `curiosity-${index + 1}`,
        prompt: question.prompt,
        correct,
      });
      next();
    } catch (caught) {
      setError(firebaseErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeaturePanel
      title="curiosity quizzes."
      subtitle="adaptive knowledge retention"
    >
      <Text style={styles.question}>{question.prompt}</Text>
      {revealed && <Text style={styles.answer}>{question.answer}</Text>}
      <Action
        title={revealed ? "Next question" : "Reveal answer"}
        onPress={revealed ? next : () => setRevealed(true)}
        disabled={saving}
      />
      {revealed && (
        <View style={styles.row}>
          <Action
            title={saving ? "Saving..." : "I got it right"}
            onPress={() => void submitResult(true)}
            disabled={saving}
          />
          <Action
            title="Need review"
            onPress={() => void submitResult(false)}
            disabled={saving}
          />
        </View>
      )}
      <Text style={styles.muted}>
        Question {index + 1} of {QUIZ_QUESTIONS.length} - drawn from your field
        learning path.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </FeaturePanel>
  );
}

function ComingSoonFeature({ title }: { title: string }) {
  return (
    <FeaturePanel title={title} subtitle="feature coming soon">
      <Text style={styles.result}>Feature coming soon.</Text>
    </FeaturePanel>
  );
}

function FeaturePanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSubtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

function Action({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.disabled]}
    >
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 28, paddingTop: 62, paddingBottom: 80 },
  back: { color: "#84cc16", fontSize: 15, fontWeight: "800", marginBottom: 38 },
  eyebrow: {
    color: "#84cc16",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  panel: { borderTopWidth: 1, borderTopColor: "#263226", paddingTop: 22 },
  panelTitle: {
    color: "#fff",
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
  },
  panelSubtitle: {
    color: "#84cc16",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 30,
  },
  result: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 23,
    marginVertical: 20,
  },
  row: { flexDirection: "row", gap: 10 },
  action: {
    alignSelf: "flex-start",
    backgroundColor: "#84cc16",
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 12,
  },
  actionText: {
    color: "#10150d",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  disabled: { opacity: 0.45 },
  error: { color: "#fca5a5", marginTop: 16, lineHeight: 20 },
  question: {
    color: "#fff",
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "800",
    marginBottom: 18,
  },
  answer: { color: "#bef264", fontSize: 16, lineHeight: 24, marginBottom: 10 },
  muted: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
  },
  bioRoot: { flex: 1, backgroundColor: "#090909" },
  bioFallback: { flex: 1, backgroundColor: "#0f1110" },
  bioOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,7,6,0.56)",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
  },
  bioNavRow: {
    position: "absolute",
    top: 82,
    left: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  bioBack: { color: "#f8fafc", fontSize: 14, fontWeight: "700" },
  bioHint: { color: "rgba(255,255,255,0.44)", fontSize: 12 },
  reticleLayer: {
    position: "absolute",
    top: "30%",
    width: "100%",
    alignItems: "center",
    zIndex: 9,
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
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  reticleText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  permissionButton: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(9,10,9,0.65)",
  },
  permissionText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  processingLayer: {
    ...StyleSheet.absoluteFillObject,
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
  telemetryBox: {
    position: "absolute",
    top: 90,
    right: 18,
    gap: 8,
    maxWidth: 260,
  },
  telemetry: {
    color: "rgba(220,252,231,0.92)",
    fontSize: 12,
    textTransform: "lowercase",
    letterSpacing: 0.5,
  },
  dossierSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "85%",
    backgroundColor: "#0b0c0b",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 20,
    zIndex: 11,
  },
  dossierBlob: {
    position: "absolute",
    top: 16,
    left: 14,
    width: 180,
    height: 120,
    borderRadius: 90,
    backgroundColor: "rgba(34,197,94,0.24)",
  },
  dossierTitle: {
    color: "#fff",
    fontSize: 46,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
    marginTop: 24,
  },
  dossierSubtitle: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 17,
    fontStyle: "italic",
    marginTop: 6,
    marginBottom: 16,
  },
  dossierRow: {
    color: "rgba(241,245,249,0.88)",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  matchText: {
    color: "#86efac",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  quizRitualRow: {
    marginTop: 18,
    alignItems: "flex-start",
  },
  quizLabel: { color: "rgba(226,232,240,0.88)", fontSize: 14 },
  quizWordWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  quizWordTarget: {
    color: "rgba(255,255,255,0.2)",
    fontWeight: "800",
    fontSize: 44,
    letterSpacing: -1.5,
    textTransform: "lowercase",
  },
  quizWordActive: {
    color: "#16a34a",
    fontWeight: "900",
    fontSize: 44,
    letterSpacing: -1.5,
    textTransform: "lowercase",
  },
  quizWordActiveSnapped: { color: "#ffffff" },
  discoveredRow: { marginTop: 26 },
  discoveredLabel: {
    color: "rgba(226,232,240,0.58)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  discoveredWordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  discoveredTarget: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    textTransform: "lowercase",
  },
  discoveredWordActive: {
    color: "#16a34a",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    textTransform: "lowercase",
  },
  discoveredWordSaving: { color: "#f8fafc" },
  modeSelector: {
    position: "absolute",
    bottom: 38,
    width: "100%",
    height: 64,
    zIndex: 15,
    backgroundColor: "transparent",
  },
});
