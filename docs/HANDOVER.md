# Handover prompt for Claude Code

Paste everything below the line into a Claude Code session started in the repo root.

---

You are taking over **Tarnished's Ledger**, a static, no-build Elden Ring 100% checklist web app (ES modules, localStorage, PWA, GitHub Pages). Repo: https://github.com/dsameendra/tarnished-ledger. Work in this clone. Read `README.md` and skim `js/` first.

## Rules
- Commit as you go, in small commits. Author must be `dsameendra <dumindu0043@gmail.com>` (set repo-local git config). End each message with:
  `Co-Authored-By: Claude <noreply@anthropic.com>`
- Do not use or scrape game art, icons or maps (copyright). Icons, trophy medals and the map are original SVG drawings. Wiki links use `https://eldenring.wiki.gg/wiki/Special:Search?go=Go&search=...`.
- Only write game facts you have verified from sources. The DLC has **no trophies or achievements**; it is modelled as goals and counters.
- Prefer concise code without needless comments. Test in a browser (Playwright/Chromium at 390px and 1280px, light and dark; serve with `python3 -m http.server`; block Google Fonts in tests).
- Branch `dlc-wip` holds unmerged work in progress that has NOT been tested. `main` is deployable. Finish on `dlc-wip`, test, then merge into `main` and push.

## Architecture (done)
- `index.html` shell: side rail at >=980px, bottom nav on phones, six tabs (route, trophies, legendary, map, guide, settings).
- `js/app.js` boots everything. `js/lib/`: `store.js` (state, key `tarnished-ledger:v2`), `sync.js`, `model.js`, `icons.js`, `wake.js`, `dom.js` (event bus), `labels.js`. `js/ui/`: `nav, rail, route, lists, map, guide, settings`. `js/data/`: `route, trophies, map, links, guide` plus the new `dlc-route, dlc-goals`.
- Progress is `marks: {stepId: [0|1, timestamp]}`, merged newest-wins per step. Settings are per device, except the **profile** (platform, dlc, focus, with `profileT`) and **counters** (`sf`, `rsa`), which sync.
- Sync: optional private GitHub Gist (`tarnished-ledger.json`) using a pasted classic PAT with `gist` scope; syncs on load, on visibility change and debounced after changes. Backup by file or `ER1:` code also exists.
- `sw.js` caches same-origin files and Google Fonts only (never api.github.com). Cache name `tarnished-ledger-v3`.
- Base game route (25 phases), trophies, legendaries, schematic map, guide tab, themes (system/light/dark, 4 accents, 3 sizes), wake lock, install prompt, storage persist: all working and on `main`.

## Done on `dlc-wip` (untested)
- `js/data/dlc-route.js`: 12 DLC phases (`d0` to `d11`) with steps `[kind, text, {g: goalKey}]`.
- `js/data/dlc-goals.js`: `GOALS` (story and optional bosses) and `COUNTERS` (Scadutree Fragments 50, Revered Spirit Ashes 25).
- `js/data/map.js`: `DLC_PINS`, `DLC_EDGES` (area-connection graph, not geography), `DLC_AREAS`.
- `js/lib/model.js` rewritten: merged `PHASES` with `dlc` flag, `phaseLabel` ("D1".. for DLC), `scope()` ("base" | "both" | "dlc" from settings `dlc` and `focus`), `inScope`, `scopedSteps`, `byGoal`, `goalDone`, scope-aware `currentPhase` and `counts` (adds `goals`, `blessings`).
- `js/lib/store.js`: settings `dlc:false`, `focus:"both"`; `counter`, `setCounter`, `COUNTER_MAX`, `mergeExtras`, extended `remoteCovers` and `snapshot` (v3), counters restored on import. `js/lib/sync.js` merges and schedules on counters and profile changes.
- `js/ui/route.js` and `js/ui/rail.js` are scope-aware (only in-scope phases render, DLC goal chips, rail shows DLC goals and blessings minis). `index.html` has the new rail minis (`mGoal`, `mBless`), `#dlcGoals`, `#mapWorld`, and a Settings "Content" group (`data-sw="dlc"`, `#focusRow` with `data-set="focus"`).

## Remaining
1. **`js/ui/lists.js`**: render `GOALS` into `#dlcGoals` (tickable via their route step, with "Show step" links) and two counter steppers (+/- and typed value) bound to `store.setCounter`, showing blessing level from fragment/ash totals. In `dlc` scope hide the trophy list and retitle "DLC goals". Note: the DLC has no trophies.
2. **`js/ui/map.js`**: show `#mapWorld` only when DLC is on; default world follows scope. Draw the DLC graph from `DLC_PINS`/`DLC_EDGES`, labelled "area connections, not geography". Use `phaseLabel` for pins and the phase list. Pins for out-of-scope phases must not render.
3. **`js/ui/settings.js`**: paint the `focus` seg, and show `#focusRow` only when `dlc` is on.
4. **`js/ui/nav.js`**: in `dlc` scope hide the Legendary tab and relabel Trophies as "Goals"; make the bottom nav grid `auto-fit` so five tabs still fill the bar.
5. **`js/app.js`**: on setting `dlc` or `focus`, call a full `renderAll` plus nav refresh; handle the `counters` event (rail and goals); keep `ensureCurrentOpen` working across scope changes.
6. **`js/ui/guide.js`**: add a DLC section when DLC is on: entry requirements (beat Radahn and Mohg, Leda at the cocoon in Mohgwyn Dynasty Mausoleum); blessings explained (Scadutree: level 1 costs 1 fragment, levels 2 to 9 cost 2, 10 to 20 cost 3, 50 total; Revered Spirit Ash: max level 10, 25 total; applied at graces; effects only in the Realm of Shadow); save-backup reminder before the Sealing Tree. Make `PLATFORMS` and trophy wording not claim DLC trophies exist.
7. **`css/styles.css`**: counter steppers, `[hidden]` handling for the new minis and rows, nav grid.
8. **`sw.js`**: add `js/data/dlc-route.js` and `js/data/dlc-goals.js` to `SHELL`; bump the cache name.
9. **Test**: first boot, tick persistence across reload, toggling DLC on, `both` and `dlc` scopes at 390px and 1280px in light and dark, counters, sync merge logic (unit-test `mergeExtras` and `remoteCovers` in Node with a fake `localStorage`), no console errors.
10. **Docs and tooling**:
    - `docs/SYNC.md`: the options below and the recommendation.
    - `docs/ARCHITECTURE.md`, `docs/DATA.md` (step format, kinds, goal keys, how to add a phase), `docs/DEPLOY.md`.
    - `scripts/check.mjs` (unique step ids, valid trophy/collectible/goal keys, map pins exist for every phase) and `package.json` scripts.
    - `.github/workflows/ci.yml` (pushing workflows may be blocked by token scope: if so, say so).
    - `404.html`, README update, `.gitignore`.
11. **Pages**: GitHub Pages must be enabled manually (Settings, Pages, deploy from `main` / root). Site: https://dsameendra.github.io/tarnished-ledger/. The API could not enable it.
12. **History fix (ask the user first)**: the first commit `080e3df` has the wrong author (`Claude`). Offer to rewrite history and force-push; do not do it unasked.

## Sync options to document in `docs/SYNC.md`
- **A. Gist + PAT (built, recommended now):** free, private, no server; downside is pasting a token on each device.
- **B. Supabase/Firebase with login:** realtime, no token pasting; needs a project and keys.
- **C. Cloudflare Worker + KV with a sync code:** needs a Worker.
- **D. Manual file/code backup (built).**
- GitHub OAuth device flow is not possible from a browser (CORS and client secret).
- Recommendation: keep A now, consider B later.

## Constraints to remember
- The Playwright smoke test used `p.route(fonts, abort)`; Google Fonts is unreachable in sandboxes.
- iOS home-screen apps have storage separate from Safari, so sync or backup is how progress moves between them.
- Final user-facing summary must mention: Pages manual enable, no game art used, the `080e3df` author issue, and that the earlier Claude artifact versions are stale.
