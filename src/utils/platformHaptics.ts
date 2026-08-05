// utils/platformHaptics.ts
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Android has less precise haptics, so we map to available options
export const getHapticPattern = (type: 'light' | 'medium' | 'heavy') => {
  if (Platform.OS === 'ios') {
    return type;
  }
  
  // For Android, we simplify to available options
  if (type === 'light' || type === 'medium') {
    return Haptics.ImpactFeedbackStyle.Medium;
  }
  return Haptics.ImpactFeedbackStyle.Heavy;
};

// Usage:
// const pattern = getHapticPattern('light');
// await Haptics.impactAsync(pattern);