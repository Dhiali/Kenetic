import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface TargetZoneProps {
  size?: number;
  isActive?: boolean;
  onDrop?: () => void;
}

export const TargetZone: React.FC<TargetZoneProps> = ({
  size = 80,
  isActive = false,
  onDrop,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    if (isActive) {
      scale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
      opacity.value = withTiming(0.8, { duration: 200 });
    } else {
      opacity.value = withTiming(0.3, { duration: 200 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.zone, { width: size, height: size }, animatedStyle]}>
      <View style={styles.innerCircle} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  zone: {
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: '50%',
    height: '50%',
    borderRadius: 100,
    backgroundColor: '#000000',
  },
});