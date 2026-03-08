let generationInProgress = false;
const pendingQueue: Array<() => void> = [];

export function enqueueImageGeneration(fn: () => void) {
  if (!generationInProgress) {
    generationInProgress = true;
    fn();
    return;
  }

  pendingQueue.push(fn);
}

export function dequeueImageGeneration() {
  generationInProgress = false;
  const next = pendingQueue.shift();
  if (next) {
    generationInProgress = true;
    next();
  }
}
