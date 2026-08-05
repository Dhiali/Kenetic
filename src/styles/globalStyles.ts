// @ts-nocheck
// src/styles/globalStyles.ts
import { StyleSheet } from 'react-native';
import { colors, typography } from './colors';

export const globalStyles = StyleSheet.create({
  // Base
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Text
  text: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.size.base,
    color: colors.text,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  
  textBold: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.weight.bold,
  },
  
  textMedium: {
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.weight.medium,
  },
  
  // Headings
  h1: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: 8,
  },
  
  h2: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: 8,
  },
  
  h3: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  
  // Cards
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  
  // Buttons (for accessibility fallback)
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  
  buttonText: {
    color: colors.background,
    fontWeight: typography.weight.semibold,
  },
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
});