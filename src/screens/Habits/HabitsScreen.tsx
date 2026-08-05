// @ts-nocheck
// screens/Habits/HabitsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useHaptics } from '../../hooks/useHaptics';
import { DraggableCard } from '../../components/common/DraggableCard';
import { TargetZone } from '../../components/common/TargetZone';
import { useHabits } from '../../contexts/HabitContext';
import { BreathingCard } from '../../components/ui/BreathingCard';

const { width, height } = Dimensions.get('window');

// Predefined habits for MVP
const PRESET_HABITS = [
  { id: '1', name: '10 Min Walk', category: 'Movement', icon: '🚶', points: 15 },
  { id: '2', name: 'Sunrise/Sunset', category: 'Nature', icon: '🌅', points: 20 },
  { id: '3', name: 'Crafting', category: 'Creative', icon: '✂️', points: 25 },
];

export const HabitsScreen = () => {
  const { heavyImpact, mediumImpact } = useHaptics();
  const { habits, completions, addCompletion, loading } = useHabits();
  const [selectedHabit, setSelectedHabit] = useState<any>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  // Animated values
  const doneAnchorScale = useSharedValue(1);
  const completionOpacity = useSharedValue(0);

  useEffect(() => {
    // Calculate streak and total points
    // This would come from your context or backend
    const currentStreak = 5; // Demo value
    const points = 150; // Demo value
    setStreak(currentStreak);
    setTotalPoints(points);
  }, []);

  const handleHabitComplete = useCallback(async (habit: any) => {
    setSelectedHabit(habit);
    
    // Add completion to backend
    await addCompletion(habit.id);
    
    // Trigger animations
    doneAnchorScale.value = withSequence(
      withTiming(1.3, { duration: 200 }),
      withSpring(1, { damping: 10 })
    );
    
    completionOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 500, delay: 1000 })
    );
    
    setShowCompletion(true);
    heavyImpact();
    
    // Reset after animation
    setTimeout(() => {
      setShowCompletion(false);
      setSelectedHabit(null);
    }, 2000);
  }, [addCompletion, heavyImpact]);

  const doneAnchorStyle = useAnimatedStyle(() => ({
    transform: [{ scale: doneAnchorScale.value }],
  }));

  const completionStyle = useAnimatedStyle(() => ({
    opacity: completionOpacity.value,
  }));

  // Check if habit was already completed today
  const isCompletedToday = (habitId: string) => {
    // Implement your logic to check if habit was completed today
    return false;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Stats */}
        <View style={styles.header}>
          <View style={styles.statContainer}>
            <Text style={styles.statNumber}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          
          <View style={styles.statContainer}>
            <Text style={styles.statNumber}>{totalPoints}</Text>
            <Text style={styles.statLabel}>Total Points</Text>
          </View>
        </View>

        {/* Habit Cards */}
        <View style={styles.habitsContainer}>
          {PRESET_HABITS.map((habit) => (
            <BreathingCard key={habit.id} style={styles.habitCard}>
              <GestureDetector
                gesture={Gesture.Pan()
                  .onEnd((event) => {
                    // Check if dragged to done zone
                    const doneZoneX = width - 100;
                    const doneZoneY = height / 2;
                    const distance = Math.sqrt(
                      Math.pow(event.translationX - doneZoneX, 2) +
                      Math.pow(event.translationY - doneZoneY, 2)
                    );
                    
                    if (distance < 80 && !isCompletedToday(habit.id)) {
                      runOnJS(handleHabitComplete)(habit);
                    }
                  })
                }
              >
                <View style={styles.habitContent}>
                  <Text style={styles.habitIcon}>{habit.icon}</Text>
                  <View style={styles.habitText}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={styles.habitCategory}>{habit.category}</Text>
                  </View>
                  <Text style={styles.habitPoints}>+{habit.points}</Text>
                </View>
              </GestureDetector>
            </BreathingCard>
          ))}
        </View>

        {/* Space for custom habits */}
        <View style={styles.customHabitsContainer}>
          <Text style={styles.sectionTitle}>Add Custom Habit</Text>
          <BreathingCard style={styles.addHabitCard}>
            <View style={styles.addHabitContent}>
              <Text style={styles.addHabitText}>+ New Habit</Text>
            </View>
          </BreathingCard>
        </View>
      </ScrollView>

      {/* Done Anchor - Fixed Position */}
      <Animated.View style={[styles.doneAnchor, doneAnchorStyle]}>
        <TargetZone size={100} isActive={true} />
        <Text style={styles.doneAnchorText}>DONE</Text>
      </Animated.View>

      {/* Completion Feedback */}
      {showCompletion && selectedHabit && (
        <Animated.View style={[styles.completionFeedback, completionStyle]}>
          <Text style={styles.completionText}>
            {selectedHabit.icon} {selectedHabit.name}
          </Text>
          <Text style={styles.completionPoints}>
            +{selectedHabit.points} points!
          </Text>
          <Text style={styles.completionStreak}>
            Streak: {streak + 1} days
          </Text>
        </Animated.View>
      )}

      {/* Streak Visualization */}
      <View style={styles.streakContainer}>
        {Array.from({ length: 7 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.streakDay,
              index < streak ? styles.streakDayActive : styles.streakDayInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100, // Space for done anchor
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  statContainer: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  habitsContainer: {
    gap: 20,
    marginBottom: 30,
  },
  habitCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  habitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  habitIcon: {
    fontSize: 28,
  },
  habitText: {
    flex: 1,
  },
  habitName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  habitCategory: {
    fontSize: 14,
    color: '#666666',
  },
  habitPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0078FF',
  },
  customHabitsContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 15,
  },
  addHabitCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  addHabitText: {
    fontSize: 16,
    color: '#666666',
  },
  doneAnchor: {
    position: 'absolute',
    bottom: 50,
    right: 50,
    alignItems: 'center',
  },
  doneAnchorText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  completionFeedback: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -150 }, { translateY: -100 }],
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  completionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  completionPoints: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0078FF',
    marginBottom: 4,
  },
  completionStreak: {
    fontSize: 14,
    color: '#666666',
  },
  streakContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  streakDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  streakDayActive: {
    backgroundColor: '#0078FF',
  },
  streakDayInactive: {
    backgroundColor: '#E0E0E0',
  },
});