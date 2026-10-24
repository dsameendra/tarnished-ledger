# Sync options

Progress is `marks` (step id to `[done, timestamp]`, newest wins per step), plus the shared profile (platform, DLC choice, focus) and the two blessing counters. Appearance settings stay per device.

## A. Gist + personal access token (built, recommended now)
Progress lives in a private gist (`tarnished-ledger.json`) on your own GitHub account. Create a classic token with only the `gist` scope and paste it on each device. Free, no server. Downside: pasting a token on every device.

### How it behaves
- **When it runs:** on load, when the page becomes visible again (if the last run was over 20 seconds ago), and 1.5 seconds after a change (debounced). A change still waiting on the debounce is sent at once when the page is hidden. A change made while a sync is already running triggers one more sync straight after it. Coming back online also triggers a sync.
- **Merge:** each step, counter and the profile carries a timestamp and the newer one wins. On an exact tie, "done" wins so both devices settle on the same value. Remote entries for unknown step ids, malformed entries and unknown profile values are ignored. The merged result is pushed only when the gist is behind.
- **Reset:** Reset progress stamps every step (including ones this device has not seen yet) and both counters with a time newer than anything this device holds, and records it as the reset watermark (`resetT`, schema v5). Found markers and counters stamped at or before the watermark are ignored on merge, so a marker another device found earlier and this one never saw cannot come back. A device that receives a newer `resetT` drops what it holds at or before it. Older app versions ignore the field. Restoring a full backup (one that carries found markers) sets the watermark the same way.
- **Clocks:** every change is stamped strictly newer than the record it replaces (ticks, counters, map filters, profile, reset). Remote timestamps count as at most five minutes ahead of this device's clock, so one device with a fast clock cannot make its records win forever.
- **Counters:** a blessing counter is the quantity of the map markers found (a marker titled "x2" counts 2, so all markers give exactly 50 and 25) plus a hand-set offset. The offset is last-writer-wins, so typing a total on a device that has not yet seen the other device's finds adds those finds once they arrive.
- **Limits:** found marker ids must be numeric and at most 10,000 are kept (the map has about 7,500), so a broken backup cannot fill the browser's storage.
- **Undo:** Reset and Restore keep one compact copy of what they replaced (`tarnished-ledger:v2:before`). "Undo last reset or restore" in Settings applies it with fresh timestamps, so the undo also wins when it syncs.
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
Download or restore a JSON file, or copy an `ER1:` code (done step ids only, no counters). Importing replaces local progress: steps missing from the backup are cleared. A code carries steps only, so found markers and counters stay as they are; a backup file replaces those too. The confirmation shows how many done steps the code or file has next to how many you have. Useful for moving progress to an iOS home-screen app, which has storage separate from Safari.

## Not possible
GitHub OAuth device flow cannot run from a browser (CORS and a client secret are required).

## Recommendation
Keep A now and consider B later if pasting a token becomes a nuisance.
