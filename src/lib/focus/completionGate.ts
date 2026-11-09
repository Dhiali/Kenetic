export function createCompletionGate() {
  let running = false;
  let failed = false;
  return {
    start(retry = false) {
      if (running || (failed && !retry)) return false;
      running = true;
      if (retry) failed = false;
      return true;
    },
    fail() {
      running = false;
      failed = true;
    },
  };
}
