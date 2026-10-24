// Registers the service worker and offers a new version without ever swapping code under a running page.
// A changed sw.js installs in the background and waits; this shows a one-line notice above the tab bar, and only a tap on
// "Update" activates it. "Later" hides it, and ignoring it is safe: the new version starts on the next launch.
// When any tab's update activates, every open tab learns of it (controllerchange) and offers a reload, because the
// old cache is gone and lazy imports there would otherwise load newer files than the page started with.
export function initUpdates() {
  if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloadOnChange = false; // this tab's own button was pressed
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // first install claiming the page is not an update
    if (reloadOnChange) location.reload(); else showNotice("Updated in another tab. Reload to use it.", "Reload", () => location.reload());
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    const offer = () => { if (hadController && reg.waiting) showNotice("A new version is ready.", "Update", (go) => update(reg, go)); };
    offer();
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed") offer(); });
    });
    // A long-lived installed app never navigates, so look for a new sw.js when it comes back to the foreground.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});

  // Always message the worker that is waiting now: the one seen when the notice appeared may since have been replaced.
  function update(reg, go) {
    go.disabled = true;
    reloadOnChange = true;
    (reg.waiting || reg.installing)?.postMessage("skipWaiting");
    setTimeout(() => { go.disabled = false; reloadOnChange = false; }, 5000);
  }
}

export function showNotice(message, action, onAction) {
  document.getElementById("updateNote")?.remove();
  const box = document.createElement("div");
  box.id = "updateNote";
  box.className = "update-note";
  box.setAttribute("role", "status");
  const msg = document.createElement("span");
  const go = document.createElement("button");
  go.type = "button"; go.className = "btn primary"; go.textContent = action;
  go.onclick = () => onAction(go);
  const later = document.createElement("button");
  later.type = "button"; later.className = "btn"; later.textContent = "Later";
  later.onclick = () => box.remove();
  box.append(msg, go, later);
  // in the page first, text second: a status region only announces text that changes while it is there
  document.body.append(box);
  msg.textContent = message;
}
