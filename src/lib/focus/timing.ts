export function focusRemainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function shouldStartFocus(launched: boolean, left: boolean, appState: string): boolean {
  return launched && left && appState === "active";
}
