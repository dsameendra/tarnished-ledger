# Deploy

The site is static. GitHub Pages must be enabled by hand: repository Settings, Pages, deploy from branch `main`, folder `/ (root)`. The site is then at https://dsameendra.github.io/tarnished-ledger/.

Releasing: change files, add any new file to `SHELL` in `sw.js`, run `npm run bump`, then `npm run check` and `npm test`, commit and push. `bump` hashes every file the service worker serves cache-first (`SHELL` and `MAP_PACK`), writes the hash to `SHELL_HASH` in `sw.js` and increments `CACHE`. `npm run check`, `npm test` and CI fail if any of those files changed without a bump, because the app is served cache-first and an unbumped change would never reach users who already have it.

How an update reaches a user: the browser fetches `sw.js` on every launch (registered with `updateViaCache: "none"`, and again when the installed app returns to the foreground). A changed `sw.js` installs the new cache in the background and waits. The page then shows "A new version is ready." with a "Reload to update" button; nothing reloads by itself, so a half-ticked session is never interrupted. If the notice is ignored, the new version takes over once every window of the app is closed.

Run locally with `npm run serve` and open http://localhost:8080.
