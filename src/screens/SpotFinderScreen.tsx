import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import SwipeAction from "../components/SwipeAction";
import {
  addSavedPlace,
  changeSavedPlaceName,
  loadSavedPlaces,
  persistOutdoorFeatureLaunch,
  removeSavedPlace,
} from "../lib/firebase/bootstrap";
import { googlePlacesApiKey } from "../lib/firebase/config";
import { firebaseErrorMessage } from "../lib/firebase/errors";
import type { SavedPlaceRecord } from "../lib/firebase/firestore";
import { requestForegroundLocation } from "../lib/outdoors/location";
import { searchNearbyPlaces, type NearbyPlace } from "../lib/outdoors/places";

export default function SpotFinderScreen({ onBack }: { onBack: () => void }) {
  const [places, setPlaces] = useState<SavedPlaceRecord[]>([]);
  const [results, setResults] = useState<NearbyPlace[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

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
      console.warn("Could not record spot finder launch:", failure);
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

  async function findNearby() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSearchMessage("");
    try {
      if (!googlePlacesApiKey) {
        throw new Error("Nearby search is not configured. You can still add a place manually below.");
      }
      const location = await requestForegroundLocation();
      if (!location) throw new Error("Location permission was not granted.");
      const found = await searchNearbyPlaces(location);
      setResults(found);
      if (found.length === 0) setSearchMessage("No nearby parks or hiking areas were found.");
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
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      alwaysBounceVertical
    >
      <SwipeAction label="← outdoors" onActivate={onBack} />
      <Text style={styles.eyebrow}>your outdoor spaces</Text>
      <Text style={styles.title}>spot finder.</Text>
      <Text style={styles.copy}>
        Save a calming place you know, or search for nearby parks and hiking areas.
      </Text>
      <Text style={styles.notice}>
        Nearby search requests location permission and sends your location to Google Places.
        Google Places may require billing. Manual saved places do not use that service.
      </Text>
      <SwipeAction label="search nearby" disabled={busy} onActivate={() => void findNearby()} />
      {!!searchMessage && <Text style={styles.copy}>{searchMessage}</Text>}
      {results.map((place) => (
        <View key={place.placeId} style={styles.item}>
          <Text style={styles.itemTitle}>{place.name}</Text>
          {!!place.address && <Text style={styles.copy}>{place.address}</Text>}
          <SwipeAction
            label={`save ${place.name}`}
            disabled={busy}
            onActivate={() => void perform(() => addSavedPlace(place.name, place.address))}
          />
        </View>
      ))}
      <Text style={styles.section}>add a place manually.</Text>
      <TextInput
        accessibilityLabel="Place name"
        value={name}
        onChangeText={setName}
        placeholder="place name"
        placeholderTextColor="#a1a1a1"
        style={styles.input}
        maxLength={100}
      />
      <TextInput
        accessibilityLabel="Place address or description, optional"
        value={address}
        onChangeText={setAddress}
        placeholder="address or description (optional)"
        placeholderTextColor="#a1a1a1"
        style={styles.input}
        maxLength={200}
      />
      <SwipeAction
        label="save place"
        disabled={busy || !name.trim()}
        onActivate={() => void perform(async () => {
          await addSavedPlace(name, address);
          setName("");
          setAddress("");
        })}
      />
      <Text style={styles.section}>saved places.</Text>
      {loading ? <ActivityIndicator color="#bef264" accessibilityLabel="Loading saved places" /> : (
        places.length === 0 && !error ? <Text style={styles.copy}>No saved places yet.</Text> :
          places.map((place) => (
            <View key={place.placeId} style={styles.item}>
              {editing === place.placeId ? (
                <>
                  <TextInput
                    accessibilityLabel={`Edit name for ${place.name}`}
                    value={editName}
                    onChangeText={setEditName}
                    style={styles.input}
                    maxLength={100}
                  />
                  <SwipeAction label="save name" disabled={busy || !editName.trim()} onActivate={() => void perform(async () => {
                    await changeSavedPlaceName(place.placeId, editName);
                    setEditing(null);
                  })} />
                  <SwipeAction label="cancel editing" disabled={busy} onActivate={() => setEditing(null)} />
                </>
              ) : (
                <>
                  <Text style={styles.itemTitle}>{place.name}</Text>
                  {!!place.address && <Text style={styles.copy}>{place.address}</Text>}
                  <SwipeAction label={`edit ${place.name}`} disabled={busy} onActivate={() => {
                    setEditing(place.placeId);
                    setEditName(place.name);
                  }} />
                  <SwipeAction label={`delete ${place.name}`} disabled={busy} onActivate={() => void perform(() => removeSavedPlace(place.placeId))} />
                </>
              )}
            </View>
          ))
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!error && <SwipeAction label="reload saved places" disabled={busy} onActivate={() => void load()} />}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 28, paddingTop: 58, paddingBottom: 80 },
  eyebrow: { color: "#84cc16", fontSize: 12, fontWeight: "800", letterSpacing: 2, marginTop: 30 },
  title: { color: "#fff", fontSize: 38, fontWeight: "900", marginTop: 12 },
  copy: { color: "#d0d0d0", fontSize: 15, lineHeight: 23, marginTop: 12 },
  notice: { color: "#a8b7a4", fontSize: 13, lineHeight: 20, marginTop: 18 },
  section: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 34, marginBottom: 12 },
  item: { borderTopWidth: 1, borderTopColor: "#263226", paddingTop: 18, marginTop: 16 },
  itemTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  input: { color: "#fff", borderBottomWidth: 1, borderColor: "#667366", paddingVertical: 12, fontSize: 16 },
  error: { color: "#fca5a5", lineHeight: 21, marginTop: 20 },
});
