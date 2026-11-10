import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SwipeAction from "../components/SwipeAction";
import {
  clearChallengeStatus,
  loadChallengeAnchor,
  loadChallengeStatus,
  loadCompletedChallenges,
  persistOutdoorFeatureLaunch,
  updateChallengeStatus,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import { challengeWindow, completedChallengeHistory, formatChallengeCountdown, type CompletedChallenge } from "../lib/outdoors/dailyChallenge";

type Status = "available" | "started" | "completed";
type Window = ReturnType<typeof challengeWindow>;

export default function DailyChallengesScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [window, setWindow] = useState<Window | null>(null);
  const [status, setStatus] = useState<Status>("available");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CompletedChallenge[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const loadVersionRef = useRef(0);
  const statusLabel = status === "available" ? "READY WHEN YOU ARE" : status === "started" ? "IN PROGRESS" : "COMPLETED";
  const statusMessage = status === "available"
    ? "Take this at your own pace."
    : status === "started"
      ? "Your challenge is in progress. Come back when you're ready to mark it complete."
      : "Congratulations! You completed this challenge. Your progress has been saved.";

  async function load() {
    if (savingRef.current) return;
    const version = ++loadVersionRef.current;
    setLoading(true);
    setLoaded(false);
    setError("");
    try {
      const now = Date.now();
      const anchor = await loadChallengeAnchor(now);
      let next = challengeWindow(anchor, Date.now());
      let [nextStatus, records] = await Promise.all([loadChallengeStatus(next.id), loadCompletedChallenges()]);
      while (Date.now() >= next.endsAt) {
        next = challengeWindow(anchor, Date.now());
        nextStatus = await loadChallengeStatus(next.id);
      }
      if (!mountedRef.current || version !== loadVersionRef.current) return;
      setWindow(next);
      setStatus(nextStatus);
      setHistory(completedChallengeHistory(records));
      setNow(Date.now());
      setLoaded(true);
    } catch (failure) {
      if (mountedRef.current && version === loadVersionRef.current) setError(firebaseErrorMessage(failure));
    } finally {
      if (mountedRef.current && version === loadVersionRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void load();
    void persistOutdoorFeatureLaunch("daily-challenges").catch((failure) => {
      console.warn("Could not record daily challenge launch:", failure);
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => { mountedRef.current = false; loadVersionRef.current++; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!window || !loaded || loading || saving) return;
    const timer = setTimeout(() => void load(), Math.max(0, window.endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [window, loaded, loading, saving]);

  useEffect(() => {
    if (!window || !loaded) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [window, loaded]);

  async function update(next: "started" | "completed") {
    if (savingRef.current || loading || !window) return;
    if (Date.now() >= window.endsAt) { void load(); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const completedAt = new Date();
      await updateChallengeStatus(window.id, next, window.challenge);
      if (!mountedRef.current) return;
      setStatus(next);
      setHistory((previous) => {
        const remaining = previous.filter((item) => item.id !== window.id);
        return next === "completed"
          ? [{ id: window.id, challenge: window.challenge, completedAt: completedAt.getTime() }, ...remaining]
          : remaining;
      });
    } catch (failure) {
      if (mountedRef.current) setError(firebaseErrorMessage(failure));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  async function clear() {
    if (savingRef.current || loading || !window) return;
    if (Date.now() >= window.endsAt) { void load(); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await clearChallengeStatus(window.id);
      if (!mountedRef.current) return;
      setStatus("available");
      setHistory((previous) => previous.filter((item) => item.id !== window.id));
    } catch (failure) {
      if (mountedRef.current) setError(firebaseErrorMessage(failure));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 48 }]}
      showsVerticalScrollIndicator={false}
    >
      <SwipeAction label="Back to outdoors" onActivate={onBack} />
      {window && loaded && !loading && (
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>NEXT CHALLENGE IN</Text>
          <Text style={styles.timer} accessibilityLabel={`Next challenge in ${formatChallengeCountdown(window.endsAt, now)}`}>
            {formatChallengeCountdown(window.endsAt, now)}
          </Text>
          <Text style={styles.timerHint}>A new invitation arrives every 24 hours.</Text>
        </View>
      )}
      <Text style={styles.eyebrow}>OUTDOORS / DAILY CHALLENGE</Text>
      <Text style={styles.title}>A moment outside.</Text>
      <Text style={styles.intro}>A small invitation to notice the world around you.</Text>
      {window && !loading && loaded && <View style={styles.challengeCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardEyebrow}>YOUR CURRENT CHALLENGE</Text>
          <Text style={styles.day}>Next challenge after {new Date(window.endsAt).toLocaleString()}</Text>
        </View>
        <Text style={styles.description}>{window.challenge}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>YOUR PACE. YOUR SPACE.</Text>
        </View>
      </View>}
      <View style={styles.safetyCard}>
        <Text style={styles.safetyLabel}>MAKE IT YOUR OWN</Text>
        <Text style={styles.safety}>Choose a safe, accessible place. You can adapt the activity to your surroundings.</Text>
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#a5e9bb" accessibilityLabel="Loading challenge" />
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      ) : loaded ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
          <Text style={styles.status}>{statusLabel}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.progressMessage}>{statusMessage}</Text>
          {status === "available" && (
            <SwipeAction label="Start challenge" disabled={saving} onActivate={() => void update("started")} />
          )}
          {status === "started" && (
            <SwipeAction label="Mark complete" disabled={saving} onActivate={() => void update("completed")} />
          )}
          {status === "started" && (
            <SwipeAction label="Clear this challenge's progress" disabled={saving} onActivate={() => void clear()} />
          )}
          {saving && <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Saving progress...</Text>}
        </View>
      ) : null}
      {loaded && !loading && (
        <View style={styles.historySection}>
          <Text style={styles.progressLabel}>YOUR JOURNEY</Text>
          <Text style={styles.historyTitle}>Completed challenges.</Text>
          {history.length === 0 ? (
            <Text style={styles.progressMessage}>Your completed challenges will appear here.</Text>
          ) : history.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={styles.historyBadge}>COMPLETED</Text>
              <Text style={styles.historyChallenge}>{item.challenge}</Text>
              {item.completedAt !== null && (
                <Text style={styles.historyDate}>{new Date(item.completedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</Text>
              )}
            </View>
          ))}
        </View>
      )}
      {!!error && (
        <View>
          <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
          {!saving && <SwipeAction label="Reload challenge" onActivate={() => void load()} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a110c" },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  eyebrow: { color: "#a5e9bb", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 24 },
  title: { color: "#fff", fontSize: 46, lineHeight: 50, fontWeight: "900", letterSpacing: -1.7, marginTop: 14 },
  intro: { color: "#cfdfd4", fontSize: 16, lineHeight: 24, marginTop: 14 },
  timerCard: { backgroundColor: "#14291b", borderColor: "#346348", borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 22 },
  timerLabel: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  timer: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: 1, marginTop: 8, fontVariant: ["tabular-nums"] },
  timerHint: { color: "#c5e1cd", fontSize: 13, lineHeight: 19, marginTop: 5 },
  challengeCard: { backgroundColor: "#1d3d29", borderColor: "#4b8b60", borderWidth: 1, borderRadius: 24, padding: 22, marginTop: 28 },
  cardHeader: { gap: 8 },
  cardEyebrow: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  day: { color: "#c5e1cd", fontSize: 13, lineHeight: 19 },
  description: { color: "#fff", fontSize: 25, lineHeight: 33, fontWeight: "800", letterSpacing: -0.4, marginTop: 24 },
  cardFooter: { borderTopWidth: 1, borderTopColor: "#527a5d", marginTop: 26, paddingTop: 15 },
  cardFooterText: { color: "#c5e1cd", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  safetyCard: { backgroundColor: "#14241a", borderWidth: 1, borderColor: "#346348", borderRadius: 20, padding: 18, marginTop: 14 },
  safetyLabel: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  safety: { color: "#cbded0", fontSize: 14, lineHeight: 21, marginTop: 10 },
  loading: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 26 },
  loadingText: { color: "#cbded0", fontSize: 13, lineHeight: 20 },
  progressCard: { marginTop: 28 },
  progressLabel: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  status: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 10 },
  progressMessage: { color: "#bacfc0", fontSize: 14, lineHeight: 21, marginTop: 8 },
  historySection: { marginTop: 32 },
  historyTitle: { color: "#fff", fontSize: 25, lineHeight: 31, fontWeight: "800", marginTop: 8 },
  historyCard: { backgroundColor: "#14241a", borderColor: "#346348", borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 12 },
  historyBadge: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  historyChallenge: { color: "#fff", fontSize: 15, lineHeight: 22, fontWeight: "700", marginTop: 8 },
  historyDate: { color: "#bacfc0", fontSize: 12, marginTop: 8 },
  error: { color: "#fca5a5", lineHeight: 21, marginTop: 20 },
});
