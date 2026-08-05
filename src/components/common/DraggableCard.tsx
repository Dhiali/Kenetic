import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface DraggableCardProps {
  children: React.ReactNode;
  onDragEnd: (success: boolean) => void;
  targetPosition: { x: number; y: number };
  snapBack?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({
  children,
  onDragEnd,
  targetPosition,
  snapBack = true,
}) => {
  const position = useSharedValue({ x: 0, y: 0 });
  const isActive = useSharedValue(false);

  const gesture = Gesture.Pan()
    .onStart(() => {
      isActive.value = true;
    })
    .onUpdate((event) => {
      position.value = {
        x: event.translationX,
        y: event.translationY,
      };
    })
    .onEnd((event) => {
      const distance = Math.sqrt(
        Math.pow(event.translationX - targetPosition.x, 2) +
        Math.pow(event.translationY - targetPosition.y, 2)
      );
      
      const success = distance < 50; // 50px threshold
      
      if (success) {
        position.value = {
          x: targetPosition.x,
          y: targetPosition.y,
        };
        runOnJS(onDragEnd)(true);
      } else if (snapBack) {
        position.value = { x: 0, y: 0 };
        runOnJS(onDragEnd)(false);
      }
      
      isActive.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value.x },
      { translateY: position.value.y },
    ],
    zIndex: isActive.value ? 100 : 0,
    shadowOpacity: isActive.value ? 0.5 : 0.2,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
});