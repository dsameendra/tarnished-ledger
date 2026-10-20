// Keeps the screen awake while the page is visible, where the browser allows it.

let lock = null;
let queue = Promise.resolve();

// Calls are queued so two quick updates (a setting change and a visibility change) can never both
// request a lock, which would leak the first one and keep the screen on after the setting is turned off.
export function update(enabled, onState) {
  queue = queue.then(() => apply(enabled, onState)).catch(() => {});
  return queue;
}

async function apply(enabled, onState) {
  const want = enabled && document.visibilityState === "visible";
  if (!want) {
    if (lock) {
      const old = lock;
      lock = null;
      try { await old.release(); } catch { /* already released */ }
    }
    onState("off");
    return;
  }
  if (lock && !lock.released) { onState("on"); return; }
  if (!("wakeLock" in navigator)) { onState("unsupported"); return; }
  try {
    const mine = await navigator.wakeLock.request("screen");
    lock = mine;
    // The browser releases the lock itself when the page is hidden; only report it if it is still the current one.
    mine.addEventListener("release", () => { if (lock === mine) onState("off"); });
    onState("on");
  } catch {
    onState("blocked");
  }
}
