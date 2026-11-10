export function capitalizeSentenceStarts(text: string) {
  return text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());
}
