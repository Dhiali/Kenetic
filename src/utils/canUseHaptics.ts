// @ts-nocheck
// utils/canUseHaptics.ts
import { Platform } from 'react-native';

export const canUseHaptics = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false; // Haptics not available on web
  }
  
  try {
    // Test with a silent haptic
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return true;
  } catch (error) {
    return false;
  }
};