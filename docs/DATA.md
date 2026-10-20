# Route data

A phase is `{id, n, sub, s: [step, ...]}`. A step is `[kind, text, options]`.

- `kind`: `go`, `boss`, `item`, `quest`, `warn`, `map`, `key`, `tip`. Tips cannot be ticked.
- options: `tr` trophy key (base game only), `c` collectible id, `g` goal key (DLC only).
- Step ids are `phaseId.index`, so inserting a step in the middle shifts later ids. Append when possible, or old progress will point at the wrong steps.

## Adding a phase
1. Add it to `js/data/route.js` (base) or `js/data/dlc-route.js` (DLC) with a unique id.
2. Give it a map pin: `PINS` for base, `DLC_PINS` plus `DLC_AREAS` (and `DLC_EDGES` for connections) for the DLC. Base wiki terms go in `AREAS`.
3. Add any new goal to `js/data/dlc-goals.js`, or trophy to `trophies.js`.
4. Run `npm run check`.
5. Add new files to `SHELL` in `sw.js` and bump the cache name.

## DLC
The DLC has no trophies. Goals (`GOALS`) are ticked through their route step. Counters (`COUNTERS`) hold cumulative `levels` thresholds, verified against the wiki: Scadutree 50 fragments to level 20, Revered Spirit Ash 25 ashes to level 10. Only add facts you have verified.
