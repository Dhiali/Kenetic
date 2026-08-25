// Design tokens mirrored 1:1 from the Figma Make web build.
export const colors = {
  bgDark: "#0a0a0a",
  bgDark2: "#121212",
  bgLight: "#fafafa",
  black: "#000000",
  white: "#ffffff",
  textDark: "#111111",
  green: "#16a34a",
  rose: "#e11d48",
  orange: "#f97316",
  stone: "#d6d3d1",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  white50: "rgba(255,255,255,0.5)",
  white40: "rgba(255,255,255,0.4)",
  white30: "rgba(255,255,255,0.3)",
  white20: "rgba(255,255,255,0.2)",
  white10: "rgba(255,255,255,0.1)",
};

// Google "Inter" is preloaded via expo-font in App.tsx as "Inter_ondemand"
// falling back to system font weights when unavailable.
export const fonts = {
  black: "Inter_900Black",
  bold: "Inter_700Bold",
  semibold: "Inter_600SemiBold",
  medium: "Inter_500Medium",
  regular: "Inter_400Regular",
};
