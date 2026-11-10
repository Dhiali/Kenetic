export type SavedDiscovery = { scanId: string; title: string; summary: string };
export type DiscoveryQuizItem = {
  scanId: string;
  title: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  fact: string;
};

export function getDiscoveryQuizItems(discoveries: SavedDiscovery[], date: Date, answeredIds: readonly string[], maxItems = 5): DiscoveryQuizItem[] {
  const day = date.toISOString().slice(0, 10);
  const unique: SavedDiscovery[] = [];
  const names = new Set<string>();
  for (const discovery of discoveries) {
    const name = discovery.title.trim().toLocaleLowerCase();
    if (!name || !discovery.summary.trim() || names.has(name)) continue;
    names.add(name);
    unique.push(discovery);
  }
  const answered = new Set(answeredIds);
  return unique.flatMap((discovery, index) => {
    const scanId = `discovery-${day}-${discovery.scanId}`;
    if (answered.has(`scan-${scanId}`)) return [];
    const correct = discovery.summary.trim();
    const alternatives = unique
      .filter((other) => other.scanId !== discovery.scanId && other.summary.trim().toLocaleLowerCase() !== correct.toLocaleLowerCase())
      .map((other) => other.summary.trim())
      .filter((summary, i, all) => all.indexOf(summary) === i)
      .slice(0, 2);
    if (alternatives.length === 0) alternatives.push("Bio Radar did not provide a description.");
    const correctIndex = index % (alternatives.length + 1);
    const options = [...alternatives];
    options.splice(correctIndex, 0, correct);
    return [{
      scanId,
      title: discovery.title,
      prompt: `Which description did Bio Radar save for ${discovery.title}?`,
      options,
      correctIndex,
      fact: correct,
    }];
  }).slice(0, maxItems);
}
