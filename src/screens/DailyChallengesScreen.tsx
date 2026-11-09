import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import SwipeAction from "../components/SwipeAction";
import {
  clearTodayChallenge,
  loadTodayChallenge,
  persistOutdoorFeatureLaunch,
  updateTodayChallenge,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";

const CHALLENGES = [
  "Notice three different natural textures around you.",
  "Listen quietly for three sounds for one minute.",
  "Take a slow walk and notice five colours around you.",
  "Find a comfortable outdoor spot and take five slow breaths.",
  "Look for a repeating pattern in nature.",
  "Notice the movement of leaves, clouds, or water for a minute.",
  "Spend a minute observing light and shadow outside.",
];

type Status = "available" | "started" | "completed";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DailyChallengesScreen({ onBack }: { onBack: () => void }) {
  const [day] = useState(() => localDateKey(new Date()));
  const [status, setStatus] = useState<Status>("available");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const challenge = CHALLENGES[new Date(`${day}T12:00:00`).getDay()];

  async function load() {
    setLoading(true);
    setLoaded(false);
    setError("");
    try {
      setStatus(await loadTodayChallenge(day));
      setLoaded(true);
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void persistOutdoorFeatureLaunch("daily-challenges").catch((failure) => {
      console.warn("Could not record daily challenge launch:", failure);
    });
  }, [day]);

  async function update(next: "started" | "completed") {
    if (saving || loading) return;
    setSaving(true);
    setError("");
    try {
      await updateTodayChallenge(day, next);
      setStatus(next);
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (saving || loading) return;
    setSaving(true);
    setError("");
    try {
      await clearTodayChallenge(day);
      setStatus("available");
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SwipeAction label="← outdoors" onActivate={onBack} />
      <Text style={styles.eyebrow}>everyday outdoor grounding</Text>
      <Text style={styles.title}>daily challenge.</Text>
      <Text style={styles.day}>{day}</Text>
      <Text style={styles.description}>{challenge}</Text>
      <Text style={styles.safety}>
        Choose a safe, accessible place. You can adapt the activity to your surroundings.
      </Text>
      {loading ? (
        <ActivityIndicator color="#bef264" accessibilityLabel="Loading challenge" />
      ) : loaded ? (
        <View>
          <Text style={styles.status}>status: {status}</Text>
          {status === "available" && (
            <SwipeAction label="start challenge" disabled={saving} onActivate={() => void update("started")} />
          )}
          {status === "started" && (
            <SwipeAction label="mark complete" disabled={saving} onActivate={() => void update("completed")} />
          )}
          {status === "completed" && (
            <SwipeAction label="mark in progress" disabled={saving} onActivate={() => void update("started")} />
          )}
          {status !== "available" && (
            <SwipeAction label="clear today's progress" disabled={saving} onActivate={() => void clear()} />
          )}
          {saving && <Text style={styles.status}>saving…</Text>}
        </View>
      ) : null}
      {!!error && (
        <View>
          <Text style={styles.error}>{error}</Text>
          {!saving && <SwipeAction label="reload challenge" onActivate={() => void load()} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 28, paddingTop: 58, paddingBottom: 80 },
  eyebrow: { color: "#84cc16", fontSize: 12, fontWeight: "800", letterSpacing: 2, marginTop: 30 },
  title: { color: "#fff", fontSize: 38, fontWeight: "900", marginTop: 12 },
  day: { color: "#a3b6a3", fontSize: 13, marginTop: 10 },
  description: { color: "#fff", fontSize: 22, lineHeight: 32, marginTop: 32 },
  safety: { color: "#b5b5b5", fontSize: 14, lineHeight: 22, marginTop: 20 },
  status: { color: "#d9e8d0", fontSize: 15, marginTop: 30 },
  error: { color: "#fca5a5", lineHeight: 21, marginTop: 20 },
});
