# Contributing

Thanks for helping keep the route accurate.

## Reporting a problem
Open an issue using one of the templates. For route errors include the phase and step text, what is wrong, and a source (wiki page, guide or video timestamp).

## Making a change
1. Fork and create a branch.
2. There is no build step: `npm run serve` and edit.
3. Run `npm run check` (route data validation) and `npm test`.
4. Test in a browser at phone width (390px) and desktop width, in light and dark.
5. If you add a shipped file, add it to `SHELL` in `sw.js`. Maintainers bump the cache name on release.

## Ground rules
- Only add game facts you have verified from a source you can link.
- The Shadow of the Erdtree DLC has no trophies or achievements. Never imply it does.
- Icons, medals and map drawings are original; do not add copyrighted game art without discussing it first.
- Keep code concise and match the surrounding style. See [docs/DATA.md](docs/DATA.md) for the step format.
