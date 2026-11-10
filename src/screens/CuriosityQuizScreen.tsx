import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SwipeAction from "../components/SwipeAction";
import { loadOutdoorQuizQueue, persistOutdoorFeatureLaunch, persistOutdoorQuizResult } from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { capitalizeSentenceStarts } from "../utils/sentenceCase";
import { getCuratedQuizItems } from "../lib/outdoors/curatedQuiz";
import { getDiscoveryQuizItems } from "../lib/outdoors/discoveryQuiz";

type QuizItem = ReturnType<typeof getDiscoveryQuizItems>[number];

export default function CuriosityQuizScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"intro" | "question" | "result">("intro");
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setError("");
    void loadOutdoorQuizQueue().then(({ discoveries, answeredIds }) => {
      if (!active) return;
      const today = new Date();
      setQueue([...getDiscoveryQuizItems(discoveries, today, answeredIds), ...getCuratedQuizItems(today, answeredIds)]);
      setIndex(0);
      setStage("intro");
    }).catch((caught) => {
      if (!active) return;
      setFailed(true);
      setError(firebaseErrorMessage(caught));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    void persistOutdoorFeatureLaunch("quizzes").catch((caught) => console.error("Could not record quiz launch", caught));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [stage, index]);

  const current = queue[index];
  const isDiscovery = current?.scanId.startsWith("discovery-") ?? false;
  const completeAnswer = async () => {
    if (!current || selected === null || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await persistOutdoorQuizResult({
        questionId: `scan-${current.scanId}`,
        prompt: current.prompt,
        correct: selected === current.correctIndex,
      });
      setIndex((previous) => previous + 1);
      setSelected(null);
      setStage("intro");
    } catch (caught) {
      setError(`Could not save your answer: ${firebaseErrorMessage(caught)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 48 }]}>
        <SwipeAction label="Back to outdoors" disabled={saving} onActivate={onBack} />
        <Text style={styles.eyebrow}>OUTDOORS / CURIOSITY QUIZZES</Text>
        {loading ? (
          <Text style={styles.intro}>Loading your questions...</Text>
        ) : failed ? (
          <>
            <Text style={styles.title}>Let's try again.</Text>
            <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
            <SwipeAction label="Retry loading questions" onActivate={() => setAttempt((value) => value + 1)} />
          </>
        ) : !current ? (
          <>
            <Text style={styles.title}>All caught up.</Text>
            <Text style={styles.intro}>You've finished the available questions for today.</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>KEEP EXPLORING</Text>
              <Text style={styles.body}>Save a new Bio Radar discovery to see a question about it. More daily questions arrive after midnight UTC.</Text>
            </View>
          </>
        ) : stage === "intro" ? (
          <>
            <Text style={styles.title}>Stay curious.</Text>
            <Text style={styles.intro}>Take a moment to revisit nature, one question at a time.</Text>
            <View style={styles.highlight}>
              <Text style={styles.cardLabel}>YOUR NEXT QUESTION</Text>
              <Text style={styles.cardTitle}>{isDiscovery ? "A saved discovery" : "General nature"}</Text>
              <Text style={styles.body}>{isDiscovery ? `Recall what Bio Radar reported about ${current.title}.` : "Explore a little more about the natural world."}</Text>
              <Text style={styles.counter}>{queue.length - index} {queue.length - index === 1 ? "QUESTION" : "QUESTIONS"} REMAINING</Text>
            </View>
            <Text style={styles.note}>Bio Radar results are AI estimates, not verified identifications or safety advice.</Text>
            <SwipeAction label="Begin question" onActivate={() => setStage("question")} />
          </>
        ) : stage === "question" ? (
          <>
            <Text style={styles.progress}>QUESTION {index + 1} OF {queue.length} / {isDiscovery ? "YOUR DISCOVERY" : "GENERAL NATURE"}</Text>
            <Text style={styles.question}>{current.prompt}</Text>
            <Text style={styles.hint}>Drag an answer to the right to choose it.</Text>
            <View style={styles.options}>
              {current.options.map((option, optionIndex) => (
                <AnswerOption key={`${optionIndex}-${option}`} option={option} index={optionIndex} onChoose={() => {
                  setSelected(optionIndex);
                  setStage("result");
                }} />
              ))}
            </View>
            {isDiscovery && <Text style={styles.note}>This question recalls an AI-generated result, which may be wrong.</Text>}
          </>
        ) : (
          <>
            <Text style={styles.progress}>{isDiscovery ? "YOUR DISCOVERY" : "GENERAL NATURE"}</Text>
            <Text style={styles.title}>{selected === current.correctIndex ? "You got it." : "A little reminder."}</Text>
            <Text style={styles.intro}>{selected === current.correctIndex ? "You chose the matching answer." : "Here's the answer to remember."}</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{isDiscovery ? "WHAT BIO RADAR REPORTED" : "THE ANSWER"}</Text>
              <Text style={styles.resultText}>{capitalizeSentenceStarts(current.fact)}</Text>
            </View>
            {isDiscovery && <Text style={styles.note}>This is an AI estimate, not a verified identification. Do not rely on it for eating, handling, or safety.</Text>}
            {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
            <SwipeAction label={saving ? "Saving answer..." : "Save answer and continue"} disabled={saving} onActivate={() => void completeAnswer()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AnswerOption({ option, index, onChoose }: { option: string; index: number; onChoose: () => void }) {
  const x = useSharedValue(0);
  const gesture = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => { x.value = Math.max(0, Math.min(80, event.translationX)); })
    .onEnd((event) => { if (event.translationX >= 60) runOnJS(onChoose)(); })
    .onFinalize(() => { x.value = withSpring(0); });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Answer ${index + 1}: ${capitalizeSentenceStarts(option)}`}
        accessibilityHint="Drag right, or activate to select this answer."
        accessibilityActions={[{ name: "activate", label: "Select answer" }]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "activate") onChoose(); }}
        onAccessibilityTap={onChoose}
        style={[styles.option, style]}
      >
        <Text style={styles.optionNumber}>{String(index + 1).padStart(2, "0")}</Text>
        <Text style={styles.optionText}>{capitalizeSentenceStarts(option)}</Text>
        <Text style={styles.optionArrow}>→</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a110c" },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  eyebrow: { color: "#a5e9bb", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 24 },
  title: { color: "#fff", fontSize: 46, lineHeight: 50, fontWeight: "900", letterSpacing: -1.7, marginTop: 14 },
  intro: { color: "#cfdfd4", fontSize: 16, lineHeight: 24, marginTop: 14 },
  highlight: { backgroundColor: "#1d3d29", borderColor: "#4b8b60", borderWidth: 1, borderRadius: 24, padding: 22, marginTop: 28 },
  card: { backgroundColor: "#14241a", borderColor: "#346348", borderWidth: 1, borderRadius: 22, padding: 20, marginTop: 28 },
  cardLabel: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  cardTitle: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900", marginTop: 14 },
  body: { color: "#d3e4d7", fontSize: 15, lineHeight: 23, marginTop: 12 },
  counter: { color: "#b1d9bc", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 22 },
  note: { color: "#bacfc0", fontSize: 13, lineHeight: 20, marginTop: 20 },
  progress: { color: "#a5e9bb", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 26 },
  question: { color: "#fff", fontSize: 30, lineHeight: 37, fontWeight: "900", letterSpacing: -0.8, marginTop: 18 },
  hint: { color: "#bacfc0", fontSize: 13, lineHeight: 20, marginTop: 16 },
  options: { gap: 12, marginTop: 20 },
  option: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderColor: "#346348", backgroundColor: "#14241a", borderRadius: 18, padding: 16, minHeight: 60 },
  optionNumber: { color: "#a5e9bb", fontSize: 12, lineHeight: 21, fontWeight: "800" },
  optionText: { flex: 1, color: "#f0f8f2", fontSize: 15, lineHeight: 22 },
  optionArrow: { color: "#a5e9bb", fontSize: 18, lineHeight: 22 },
  resultText: { color: "#f0f8f2", fontSize: 16, lineHeight: 24, marginTop: 12 },
  error: { color: "#fecaca", fontSize: 13, lineHeight: 20, marginTop: 18 },
});
