# Deploy

The site is static. GitHub Pages must be enabled by hand: repository Settings, Pages, deploy from branch `main`, folder `/ (root)`. The site is then at https://dsameendra.github.io/tarnished-ledger/.

Before releasing: `npm run check`, `npm test`, bump `CACHE` in `sw.js`, and make sure new files are in `SHELL`. The service worker is network-first, so a new deploy appears on the next load.

Run locally with `npm run serve` and open http://localhost:8080.
