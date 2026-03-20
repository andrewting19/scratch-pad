# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Scratch Pad — a Chrome extension (Manifest V3) that provides a sidebar notepad via the Side Panel API, with GitHub Gist sharing for sending text blobs to LLMs or others.

## Development

No build step. Load as an unpacked extension in `chrome://extensions` (Developer Mode → Load unpacked → select this directory). Reload the extension after changes.

For testing outside Chrome, you can serve the directory locally (`python3 -m http.server`) and open `sidepanel.html` directly, but you'll need to mock `chrome.storage` and `chrome.sidePanel` APIs.

## Architecture

- **manifest.json** — Manifest V3 config. Permissions: `sidePanel`, `storage`, `activeTab`. Host permissions for `api.github.com` (Gist creation).
- **background.js** — Minimal service worker. Opens the side panel on extension icon click.
- **sidepanel.html/css/js** — The entire UI. Vanilla JS, no dependencies, no framework.

### State Model (sidepanel.js)

All state lives in a single object persisted to `chrome.storage.local` under key `scratchpad_state`:

```
{ tabs: [{ id, title, content, created, updated }], activeTabId, settings: { theme, githubPat } }
```

Auto-saves on input with 300ms debounce. Tab titles auto-derive from first line of content unless explicitly renamed (double-click tab).

### Theming

CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Theme toggle cycles through system → light → dark. System preference changes are watched via `matchMedia`.

### Gist Sharing

Uses a GitHub PAT (stored in settings, `gist` scope required). Creates **secret** (not public) gists. The share modal shows both the gist URL and the raw URL — the raw URL is auto-copied to clipboard since it's directly fetchable by LLMs with no auth.
