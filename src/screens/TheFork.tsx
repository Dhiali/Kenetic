import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

export default function TheForkScreen({ 
  onLogin, 
  onSignup 
}: { 
  onLogin: () => void; 
  onSignup: () => void; 
}) {
  // Screen entrance fade
  const opacity = useSharedValue(0);

  // Individual drag positions
  const translateXReturn = useSharedValue(0);
  const translateXBegin = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
  }, []);

  // --------------------------------------------------------
  // Gesture 1: "return." (Swipe Left)
  // --------------------------------------------------------
  const returnGesture = Gesture.Pan()
    .onChange((e) => {
      // If dragging left (correct direction), move 1:1. 
      // If dragging right, add heavy elastic resistance (0.1 ratio).
      translateXReturn.value = e.translationX < 0 
        ? e.translationX 
        : e.translationX * 0.1;
    })
    .onEnd((e) => {
      // Threshold to trigger action (-60px)
      if (e.translationX < -60) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
        runOnJS(onLogin)();
      } else {
        // Snap back to zero with a satisfying spring
        translateXReturn.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  // --------------------------------------------------------
  // Gesture 2: "begin." (Swipe Right)
  // --------------------------------------------------------
  const beginGesture = Gesture.Pan()
    .onChange((e) => {
      // If dragging right (correct direction), move 1:1. 
      // If dragging left, add heavy elastic resistance.
      translateXBegin.value = e.translationX > 0 
        ? e.translationX 
        : e.translationX * 0.1;
    })
    .onEnd((e) => {
      // Threshold to trigger action (+60px)
      if (e.translationX > 60) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
        runOnJS(onSignup)();
      } else {
        translateXBegin.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  // --------------------------------------------------------
  // Animated Styles
  // --------------------------------------------------------
  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const returnStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateXReturn.value }],
  }));

  const beginStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateXBegin.value }],
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>where to?</Text>
      </View>

      {/* Swipe Gates */}
      <View style={styles.splitContainer}>
        
        {/* Left Side: Return (Login) */}
        <View style={styles.half}>
          <GestureDetector gesture={returnGesture}>
            <Animated.View style={returnStyle}>
              <Text style={styles.dragText}>return.</Text>
            </Animated.View>
          </GestureDetector>
          <Text style={styles.helperText}>flick left</Text>
        </View>

        {/* Right Side: Begin (Signup) */}
        <View style={styles.half}>
          <GestureDetector gesture={beginGesture}>
            <Animated.View style={beginStyle}>
              <Text style={styles.dragText}>begin.</Text>
            </Animated.View>
          </GestureDetector>
          <Text style={styles.helperText}>flick right</Text>
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    marginTop: 100,
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  half: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragText: {
    color: '#16a34a', // Using the subtle green accent for interaction points
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  helperText: {
    marginTop: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 2,
    // Ensure the helper text doesn't steal touches from the drag gesture
    pointerEvents: 'none', 
  }
});