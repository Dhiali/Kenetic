export type OutdoorAnalysisStatus = "unavailable" | "ready";

export type OutdoorAnalysisInput = {
  imageUri?: string;
  audioUri?: string;
};

export type OutdoorAnalysisResult = {
  status: OutdoorAnalysisStatus;
  title?: string;
  summary?: string;
  ecologicalSignificance?: string;
  confidence?: number;
};

export type OutdoorAnalyzer = (
  input: OutdoorAnalysisInput,
) => Promise<OutdoorAnalysisResult>;

/**
 * Expo Go fallback. Native ML analysis is intentionally deferred until a
 * verified development-build provider is selected.
 */
export const unavailableOutdoorAnalyzer: OutdoorAnalyzer = async () => ({
  status: "unavailable",
});
