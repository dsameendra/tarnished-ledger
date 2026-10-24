// Registers the service worker and offers a new version without ever swapping code under a running page.
// A changed sw.js installs in the background and waits; this shows a small notice, and only a tap on
// "Reload to update" activates it. Ignoring the notice is safe: the new version starts on the next launch.
export function initUpdates() {
  if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    const offer = (w) => { if (w && hadController) showNotice(w); };
    offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed") offer(w); });
    });
    // A long-lived installed app never navigates, so look for a new sw.js when it comes back to the foreground.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

function showNotice(worker) {
  if (document.getElementById("updateNote")) return;
  const box = document.createElement("div");
  box.id = "updateNote";
  box.setAttribute("role", "status");
  box.style.cssText = "position:fixed;z-index:9999;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px);padding:6px 6px 6px 14px;background:var(--raised);color:var(--fg);border:1px solid var(--edge);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.25);font-size:.92rem";
  const msg = document.createElement("span");
  msg.textContent = "A new version is ready.";
  const go = document.createElement("button");
  go.type = "button"; go.className = "btn primary"; go.textContent = "Reload to update";
  go.onclick = () => {
    go.disabled = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    worker.postMessage("skipWaiting");
  };
  box.append(msg, go);
  document.body.append(box);
}
