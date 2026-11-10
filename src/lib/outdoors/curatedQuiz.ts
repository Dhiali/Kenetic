const questions = [
  {
    id: "pollination",
    prompt: "What can pollinators help flowering plants do?",
    options: ["Move pollen between flowers", "Turn rocks into soil", "Stop all insects from feeding"],
    correctIndex: 0,
    fact: "Pollinators can transfer pollen between flowers, helping many plants reproduce.",
  },
  {
    id: "fallen-leaves",
    prompt: "What can fallen leaves provide in a habitat?",
    options: ["A permanent barrier to rain", "Shelter and material for decomposers", "Sunlight for roots"],
    correctIndex: 1,
    fact: "Leaf litter can provide shelter and food for organisms that break down organic material.",
  },
  {
    id: "native-plants",
    prompt: "Why can native plants be useful to local wildlife?",
    options: ["They never need water", "They eliminate all non-native species", "They can provide familiar food and shelter"],
    correctIndex: 2,
    fact: "Native plants can provide food and shelter for wildlife adapted to the local environment.",
  },
] as const;

export function getCuratedQuizItems(date: Date, answeredQuestionIds: readonly string[]) {
  const day = date.toISOString().slice(0, 10);
  const answered = new Set(answeredQuestionIds);
  return questions
    .map((question) => ({
      scanId: `general-${day}-${question.id}`,
      title: "General nature",
      prompt: question.prompt,
      options: [...question.options],
      correctIndex: question.correctIndex,
      fact: question.fact,
    }))
    .filter((question) => !answered.has(`scan-${question.scanId}`));
}
