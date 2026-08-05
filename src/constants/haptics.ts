// hooks/useHaptics.ts
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export const useHaptics = () => {
  const lightImpact = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptic feedback not supported:', error);
    }
  }, []);

  const mediumImpact = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn('Haptic feedback not supported:', error);
    }
  }, []);

  const heavyImpact = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.warn('Haptic feedback not supported:', error);
    }
  }, []);

  const selection = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptic feedback not supported:', error);
    }
  }, []);

  const notify = useCallback(async (type: Haptics.NotificationFeedbackType) => {
    try {
      await Haptics.notificationAsync(type);
    } catch (error) {
      console.warn('Haptic feedback not supported:', error);
    }
  }, []);

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    selection,
    notify,
  };
};

// Usage in components:
// const { heavyImpact } = useHaptics();
// heavyImpact();