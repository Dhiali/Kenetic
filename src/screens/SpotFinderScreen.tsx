import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SwipeAction from "../components/SwipeAction";
import {
  addSavedPlace,
  changeSavedPlaceName,
  loadSavedPlaces,
  persistOutdoorFeatureLaunch,
  removeSavedPlace,
} from "../lib/firebase/bootstrap";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import type { SavedPlaceRecord } from "../lib/firebase/firestore";

export default function SpotFinderScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<SavedPlaceRecord[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setPlaces(await loadSavedPlaces());
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void persistOutdoorFeatureLaunch("spot-finder").catch((failure) => {
      console.warn("Could not record spot keeper launch:", failure);
    });
  }, []);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 48 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
    >
      <SwipeAction label="Back to outdoors" onActivate={onBack} />
      <Text style={styles.eyebrow}>OUTDOORS / SPOT KEEPER</Text>
      <Text style={styles.title}>Spot keeper.</Text>
      <Text style={styles.copy}>
        Make a little space for the places that help you feel grounded.
      </Text>
      <Text style={styles.section}>Add your own.</Text>
      <Text style={styles.sectionCopy}>Save a favorite spot to return to whenever you need it.</Text>
      <View style={styles.formCard}>
      <Text style={styles.fieldLabel}>PLACE NAME</Text>
      <TextInput
        accessibilityLabel="Place name"
        value={name}
        onChangeText={setName}
        placeholder="E.g. the quiet park"
        placeholderTextColor="#91a898"
        style={styles.input}
        maxLength={100}
      />
      <Text style={styles.fieldLabel}>ADDRESS OR DESCRIPTION <Text style={styles.optional}>(OPTIONAL)</Text></Text>
      <TextInput
        accessibilityLabel="Place address or description, optional"
        value={address}
        onChangeText={setAddress}
        placeholder="A detail to help you find it"
        placeholderTextColor="#91a898"
        style={styles.input}
        maxLength={200}
      />
      <SwipeAction
        label="Save place"
        disabled={busy || !name.trim()}
        onActivate={() => void perform(async () => {
          await addSavedPlace(name, address);
          setName("");
          setAddress("");
        })}
      />
      </View>
      <View style={styles.savedHeading}>
        <Text style={styles.savedTitle}>Saved places.</Text>
        {!loading && <Text style={styles.count}>{places.length} {places.length === 1 ? "PLACE" : "PLACES"}</Text>}
      </View>
      {loading ? <ActivityIndicator color="#a5e9bb" accessibilityLabel="Loading saved places" /> : (
        places.length === 0 && !error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your collection starts here.</Text>
            <Text style={styles.itemCopy}>Save a place above and it will be waiting here when you need it.</Text>
          </View>
        ) :
          places.map((place) => (
            <View key={place.placeId} style={styles.item}>
              {editing === place.placeId ? (
                <>
                  <Text style={styles.itemEyebrow}>EDIT PLACE NAME</Text>
                  <TextInput
                    accessibilityLabel={`Edit name for ${place.name}`}
                    value={editName}
                    onChangeText={setEditName}
                    style={styles.input}
                    maxLength={100}
                  />
                  <SwipeAction label="Save name" disabled={busy || !editName.trim()} onActivate={() => void perform(async () => {
                    await changeSavedPlaceName(place.placeId, editName);
                    setEditing(null);
                  })} />
                  <SwipeAction label="Cancel editing" disabled={busy} onActivate={() => setEditing(null)} />
                </>
              ) : (
                <>
                  <Text style={styles.itemEyebrow}>YOUR SAVED PLACE</Text>
                  <Text style={styles.itemTitle}>{place.name}</Text>
                  {!!place.address && <Text style={styles.itemCopy}>{place.address}</Text>}
                  <View style={styles.itemActions}>
                  <SwipeAction label={`Edit ${place.name}`} disabled={busy} onActivate={() => {
                    setEditing(place.placeId);
                    setEditName(place.name);
                  }} />
                  <SwipeAction label={`Delete ${place.name}`} disabled={busy} onActivate={() => void perform(() => removeSavedPlace(place.placeId))} />
                  </View>
                </>
              )}
            </View>
          ))
      )}
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      {!!error && <SwipeAction label="Reload saved places" disabled={busy} onActivate={() => void load()} />}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a110c" },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  eyebrow: { color: "#a5e9bb", fontSize: 11, fontWeight: "800", letterSpacing: 1.6, marginTop: 24 },
  title: { color: "#fff", fontSize: 48, lineHeight: 52, fontWeight: "900", letterSpacing: -1.7, marginTop: 12 },
  copy: { color: "#cfdfd4", fontSize: 16, lineHeight: 24, marginTop: 14 },
  section: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.6, marginTop: 34 },
  sectionCopy: { color: "#bacfc0", fontSize: 14, lineHeight: 21, marginTop: 8 },
  formCard: { backgroundColor: "#14241a", borderWidth: 1, borderColor: "#346348", borderRadius: 22, padding: 20, marginTop: 18 },
  fieldLabel: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 12, marginBottom: 8 },
  optional: { color: "#b1c9b8" },
  input: { color: "#fff", backgroundColor: "#0a160e", borderWidth: 1, borderColor: "#3d6649", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  savedHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 36, marginBottom: 14 },
  savedTitle: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.6 },
  count: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  emptyCard: { backgroundColor: "#14241a", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#346348" },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  item: { backgroundColor: "#14241a", borderWidth: 1, borderColor: "#346348", borderRadius: 20, padding: 20, marginTop: 10 },
  itemEyebrow: { color: "#a5e9bb", fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 10 },
  itemTitle: { color: "#fff", fontSize: 20, lineHeight: 26, fontWeight: "800" },
  itemCopy: { color: "#c5d8ca", fontSize: 14, lineHeight: 21, marginTop: 8 },
  itemActions: { alignItems: "flex-start" },
  error: { color: "#fca5a5", lineHeight: 21, marginTop: 20 },
});
