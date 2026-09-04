/**
 * Serialises long-running SQLite writers so ingest and brief never overlap,
 * whether they were started from the UI, an API call, or the in-process scheduler.
 */
let chain: Promise<unknown> = Promise.resolve();
let running = false;

export function isJobRunning(): boolean {
  return running;
}

export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const previous = chain;
  let release!: () => void;
  chain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  running = true;
  try {
    return await fn();
  } finally {
    running = false;
    release();
  }
}
