// Keeps the screen awake while the page is visible, where the browser allows it.

let lock = null;

export async function update(enabled, onState) {
  const want = enabled && document.visibilityState === "visible";
  if (!want) {
    if (lock) { try { await lock.release(); } catch { /* already released */ } lock = null; }
    onState("off");
    return;
  }
  if (lock && !lock.released) { onState("on"); return; }
  if (!("wakeLock" in navigator)) { onState("unsupported"); return; }
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => onState("off"));
    onState("on");
  } catch {
    onState("blocked");
  }
}
