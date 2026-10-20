# Sync options

Progress is `marks` (step id to `[done, timestamp]`, newest wins per step), plus the shared profile (platform, DLC choice, focus) and the two blessing counters. Appearance settings stay per device.

## A. Gist + personal access token (built, recommended now)
Progress lives in a private gist (`tarnished-ledger.json`) on your own GitHub account. Create a classic token with only the `gist` scope and paste it on each device. Free, no server. Downside: pasting a token on every device. The sync runs on load, when the page becomes visible and shortly after each change.

## B. Supabase or Firebase with login
Realtime and no token pasting, but needs a project, keys and an auth flow.

## C. Cloudflare Worker + KV with a sync code
A tiny Worker stores a blob under a secret code. Needs a Worker deployed and some abuse protection.

## D. Manual backup (built)
Download or restore a JSON file, or copy an `ER1:` code. Useful for moving progress to an iOS home-screen app, which has storage separate from Safari.

## Not possible
GitHub OAuth device flow cannot run from a browser (CORS and a client secret are required).

## Recommendation
Keep A now and consider B later if pasting a token becomes a nuisance.
