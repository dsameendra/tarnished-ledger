# Sync options

Progress is `marks` (step id to `[done, timestamp]`, newest wins per step), plus the shared profile (platform, DLC choice, focus) and the two blessing counters. Appearance settings stay per device.

## A. Gist + personal access token (built, recommended now)
Progress lives in a private gist (`tarnished-ledger.json`) on your own GitHub account. Create a classic token with only the `gist` scope and paste it on each device. Free, no server. Downside: pasting a token on every device.

### How it behaves
- **When it runs:** on load, when the page becomes visible again (if the last run was over 20 seconds ago), and 1.5 seconds after a change (debounced). A change still waiting on the debounce is sent at once when the page is hidden. A change made while a sync is already running triggers one more sync straight after it. Coming back online also triggers a sync.
- **Merge:** each step, counter and the profile carries a timestamp and the newer one wins. On an exact tie, "done" wins so both devices settle on the same value. Remote entries for unknown step ids, malformed entries and unknown profile values are ignored. The merged result is pushed only when the gist is behind.
- **Reset:** Reset progress stamps every step (including ones this device has not seen yet) and both counters with the current time, so the reset wins over older ticks on other devices.
- **Lost updates:** a gist has no compare-and-swap, so two devices writing within the same moment can overwrite each other. Each device keeps its own data and sees that the gist is missing it on its next sync, so it repairs itself.
- **Errors:** every request has a 20 second timeout. Offline, timeouts, rate limits (429, or 403 with no quota left) and GitHub errors keep the connection and local data and show a message; the next change or return to the page retries. A 401 disconnects and asks for a new token. A 403 for any other reason reports that the token may lack the `gist` scope.
- **Gist deleted or missing (404):** the app looks for another gist with the same file and otherwise creates a new one from local data.
- **Safety:** a failed download of a large (truncated) file is an error, never treated as an empty gist. A file that downloads but is not valid JSON is treated as empty and rewritten. Disconnecting while a sync is running cancels the rest of that run.
- **Token storage:** the token is kept only in this browser's `localStorage` (`tarnished-ledger:sync`). Anyone with access to the browser profile can read it, which is why it should carry only the `gist` scope.

Tests for all of the above run against a fake GitHub API in `test/sync.test.mjs`.

## B. Supabase or Firebase with login
Realtime and no token pasting, but needs a project, keys and an auth flow.

## C. Cloudflare Worker + KV with a sync code
A tiny Worker stores a blob under a secret code. Needs a Worker deployed and some abuse protection.

## D. Manual backup (built)
Download or restore a JSON file, or copy an `ER1:` code (done step ids only, no counters). Importing replaces local progress: steps missing from the backup are cleared. Useful for moving progress to an iOS home-screen app, which has storage separate from Safari.

## Not possible
GitHub OAuth device flow cannot run from a browser (CORS and a client secret are required).

## Recommendation
Keep A now and consider B later if pasting a token becomes a nuisance.
