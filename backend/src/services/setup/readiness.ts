export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Poll `probe` until it completes without throwing, or the deadline passes.
// `probe` must throw while the service isn't ready yet; the latest error message
// is handed to `onTimeout`, which builds the error thrown on timeout so each
// caller keeps its own wording.
export async function waitForReady(
  probe: () => Promise<void>,
  onTimeout: (lastError: string) => Error,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';

  while (true) {
    try {
      await probe();
      return;
    } catch (err) {
      lastError = (err as Error).message;
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw onTimeout(lastError);
    }
    await delay(pollIntervalMs);
  }
}
