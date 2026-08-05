// @ts-nocheck
// screens/Radar/BioRadarScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useHaptics } from '../../hooks/useHaptics';
import { DraggableCard } from '../../components/common/DraggableCard';
import { TargetZone } from '../../components/common/TargetZone';
import { useLocations } from '../../contexts/LocationContext';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export const BioRadarScreen = () => {
  const { heavyImpact, mediumImpact } = useHaptics();
  const { locations, fetchNearbyLocations, loading } = useLocations();
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [range, setRange] = useState(5); // km
  
  // Animated values for drag interactions
  const rangeRingScale = useSharedValue(1);
  const userAvatarPosition = useSharedValue({ x: 0, y: 0 });
  const isDraggingAvatar = useSharedValue(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      fetchNearbyLocations(location.coords.latitude, location.coords.longitude, range);
    })();
  }, []);

  const handleRangeChange = useCallback((newRange: number) => {
    setRange(newRange);
    if (userLocation) {
      fetchNearbyLocations(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        newRange
      );
    }
    mediumImpact();
  }, [userLocation, fetchNearbyLocations, mediumImpact]);

  const handleLocationSelect = useCallback((location: any) => {
    setSelectedLocation(location);
    heavyImpact();
  }, [heavyImpact]);

  const rangeGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Calculate new range based on drag distance
      const newRange = Math.min(Math.max(1, range + event.translationY * 0.1), 20);
      rangeRingScale.value = withSpring(1 + (newRange - range) * 0.1);
    })
    .onEnd((event) => {
      const newRange = Math.round(Math.min(Math.max(1, range + event.translationY * 0.1), 20));
      runOnJS(handleRangeChange)(newRange);
      rangeRingScale.value = withSpring(1);
    });

  const avatarGesture = Gesture.Pan()
    .onStart(() => {
      isDraggingAvatar.value = true;
    })
    .onUpdate((event) => {
      userAvatarPosition.value = {
        x: event.translationX,
        y: event.translationY,
      };
    })
    .onEnd((event) => {
      // Check if dropped on a location marker
      if (selectedLocation) {
        runOnJS(handleLocationSelect)(selectedLocation);
      }
      
      userAvatarPosition.value = { x: 0, y: 0 };
      isDraggingAvatar.value = false;
    });

  const rangeRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rangeRingScale.value }],
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: userAvatarPosition.value.x },
      { translateY: userAvatarPosition.value.y },
    ],
    zIndex: isDraggingAvatar.value ? 100 : 0,
  }));

  if (!userLocation) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        {/* Range Circle */}
        <Circle
          center={{
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          }}
          radius={range * 1000} // Convert km to meters
          fillColor="rgba(0, 120, 255, 0.1)"
          strokeColor="rgba(0, 120, 255, 0.5)"
          strokeWidth={2}
        />

        {/* Location Markers */}
        {locations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            onPress={() => setSelectedLocation(location)}
          >
            <View style={styles.marker}>
              <Text style={styles.markerText}>{location.type.charAt(0)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Range Ring - Draggable */}
      <GestureDetector gesture={rangeGesture}>
        <Animated.View style={[styles.rangeRing, rangeRingStyle]}>
          <View style={styles.rangeRingInner} />
          <Text style={styles.rangeText}>{range} km</Text>
        </Animated.View>
      </GestureDetector>

      {/* User Avatar - Draggable */}
      <GestureDetector gesture={avatarGesture}>
        <Animated.View style={[styles.avatar, avatarStyle]}>
          <View style={styles.avatarInner} />
        </Animated.View>
      </GestureDetector>

      {/* Target Zone for dropping avatar */}
      {selectedLocation && (
        <TargetZone
          size={100}
          isActive={true}
          style={styles.targetZone}
        />
      )}

      {/* Location Info Card */}
      {selectedLocation && (
        <DraggableCard
          onDragEnd={(success) => {
            if (success) {
              // Navigate to location details or start activity
              heavyImpact();
            }
          }}
          targetPosition={{ x: width / 2 - 50, y: height - 150 }}
        >
          <View style={styles.locationCard}>
            <Text style={styles.locationName}>{selectedLocation.name}</Text>
            <Text style={styles.locationType}>{selectedLocation.type}</Text>
            <Text style={styles.locationDistance}>
              {selectedLocation.distance?.toFixed(1)} km away
            </Text>
          </View>
        </DraggableCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  rangeRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#0078FF',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  rangeRingInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0078FF',
  },
  rangeText: {
    position: 'absolute',
    bottom: -30,
    fontSize: 16,
    fontWeight: '600',
    color: '#0078FF',
  },
  avatar: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0078FF',
  },
  markerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0078FF',
  },
  targetZone: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  locationCard: {
    padding: 20,
    minWidth: 200,
  },
  locationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  locationType: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  locationDistance: {
    fontSize: 12,
    color: '#0078FF',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 50,
  },
});