# Handover notes

For anyone (or any Claude Code session) picking the project up. Start with `README.md`, then `docs/ARCHITECTURE.md`, `docs/DATA.md` and `docs/SYNC.md`.

The DLC work that earlier versions of this file listed as remaining is finished and merged: DLC route, goals, blessing counters, scope-aware navigation, map world switch, guide section, data checks, unit tests and CI. Nothing below is pending work.

## Rules
- Commit in small commits. Author must be `dsameendra <dumindu0043@gmail.com>`. End each message with:
  `Co-Authored-By: Claude <noreply@anthropic.com>`
- Do not use or scrape game art, icons or maps (copyright). Icons, trophy medals and the map are original SVG drawings. Wiki links use `https://eldenring.wiki.gg/wiki/Special:Search?go=Go&search=...`.
- Only write game facts you have verified from sources. The DLC has **no trophies or achievements**; it is modelled as goals and counters.
- Test in a browser (Playwright, Chromium at 390px and 1280px, light and dark). Serve with `python3 -m http.server` and block Google Fonts requests, which are unreachable in sandboxes.
- Run `npm run check` and `npm test` before every commit. Bump `CACHE` in `sw.js` when shipping.

## Things to remember
- GitHub Pages must be enabled by hand (Settings, Pages, deploy from `main` / root). Site: https://dsameendra.github.io/tarnished-ledger/.
- iOS home-screen apps have storage separate from Safari, so sync or a backup is how progress moves between them.
- The first commit `080e3df` has the wrong author (`Claude`). Rewriting history needs a force-push, so ask the owner first.
