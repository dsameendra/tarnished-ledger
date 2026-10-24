# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Elden Ring players working through a 100% or platinum run of the base game and Shadow of the Erdtree. Two situations, both confirmed:

- **Mid-run:** the player glances between the game and the app, mostly on a phone beside the console or on a second monitor, often with one hand and in a dim room. The job is to see what to do next and tick it off.
- **Planning:** the same player, or someone else, reading the whole route and map at a desk before or between sessions.

A third audience is anyone who just wants to look at the guide, the map or the item lists without keeping a run. They need the same content to be easy to browse without an account.

## Product Purpose

Tarnished's Ledger is a free, open source checklist for Elden Ring that turns the community's 100% route into something a player can keep track of across a whole run: 38 route phases (26 base game, 12 Shadow of the Erdtree), 42 trophies, 30 legendary collectibles, DLC goals and blessing counters, and an interactive map. Success is a player who always knows what is next, never loses their place, and finishes the platinum without missing a missable.

## Positioning

Two things a neighbouring guide, wiki checklist or map site does not combine:

- **One connected record.** Route steps, trophies, legendary items, map markers and the DLC counters share one tick state, so ticking in any one place updates all the others.
- **The route drawn on the map.** The ordered route is drawn through each step's places, so a player follows the guide visually and not from text alone.

It works offline, installs as an app and keeps progress on the device, with optional private GitHub gist sync between devices. No account, no tracking.

## Operating Context

- Used on iPhone, Android and desktop, as a browser tab or as an installed app (the installed iPhone/iPad app has its own storage and status bar handling).
- Used beside the game, so short glances and one-handed taps matter.
- Progress is stored in the browser (`localStorage`); sync is optional and uses a private gist with a personal access token the user provides.
- Shadow of the Erdtree has no trophies, so it is tracked as a route plus goals and counters.

## Capabilities and Constraints

- **Static, no-build PWA.** Vanilla ES modules, no framework or bundler, service worker for offline, Leaflet map vendored, deployed on GitHub Pages. Future work keeps this.
- **Content is fact-checked.** Only verified game facts are written. Some items are still unverified (somber stone counts, a few route notes); do not present them as certain.
- **Terminology:** "route", "phase", "step", "legendary", "blessing" (Scadutree Fragments and Revered Spirit Ashes), "goals" (DLC), "Roundtable Hold" (map shows marker positions only).
- **Map layers:** Surface, Underground, Roundtable Hold (hub), Realm of Shadow; 7,459 markers.
- **Themes:** system, light and dark, with five accents (gold, crimson, frost, silver, Mistwood green), three text sizes and compact rows.

## Brand Commitments

- Name: Tarnished's Ledger. Subtitle: "Elden Ring and Shadow of the Erdtree".
- It is an **unofficial fan project**, not affiliated with FromSoftware or Bandai Namco.
- Icons, trophy medals and map marker glyphs are original SVG drawings. No game art is created or redistributed beyond the community map images credited below.
- Credits stay visible: map art by Eziolambo (Reddit), base-game route after ponkberry's Steam 100% guide, marker data from MapGenie's public data. Code is MIT licensed.

## Evidence on Hand

- Route, trophy, legendary and DLC data in `js/data/`; marker data in `assets/map/data/`; docs in `README.md` and `docs/`.
- Sample screenshots in `docs/screenshots/` (a sample save, not real user data).
- There are no testimonials, user counts or usage analytics. Do not invent any.

## Product Principles

1. **Glanceable during play.** The next action is always visible; reading and tapping must work one-handed and in a dim room.
2. **One truth, shown everywhere.** A tick means the same thing in the route, map, trophies and lists.
3. **Accurate over impressive.** Never state a game fact that has not been verified, and be honest where something is unknown.
4. **Works anywhere, owned by the player.** Offline, no account, progress on the device, nothing locked behind sign-in.
5. **A fan's tool, credited.** Respectful of the game and of the community work it builds on.

## Accessibility & Inclusion

- Readable one-handed on a phone: large touch targets (44px on coarse pointers) and clear text.
- Light and dark themes with contrast tested for every accent (`test/theme.test.mjs`); keep that guarantee.
- Respect the installed-app safe areas on iPhone and iPad.
