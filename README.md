# Scratch Pad

A lightweight Chrome extension that lives in the sidebar as a fast, minimal notepad — with one-click sharing via GitHub Gists.

![Light and dark themes](https://img.shields.io/badge/themes-light%20%2F%20dark-blue)
![No dependencies](https://img.shields.io/badge/dependencies-none-green)
![Manifest V3](https://img.shields.io/badge/manifest-v3-orange)

## Why

Sometimes you just need a scratchpad while browsing. And sometimes you need to share a text blob — with a coworker, in a chat, or with an LLM — but it's too long for a message. Scratch Pad handles both:

1. **Sidebar notepad** — always one click away, with tabs and auto-save
2. **Gist sharing** — creates a secret GitHub Gist and copies the raw URL, which LLMs can fetch directly (no auth wall, no JS rendering needed)

## Install

1. Clone this repo (or download as ZIP)
2. Go to `chrome://extensions`
3. Enable **Developer Mode** (top right)
4. Click **Load unpacked** and select this directory
5. Click the extension icon to open the sidebar

## Features

- **Multi-tab notepad** in Chrome's Side Panel
- **Auto-saves** everything to local storage — never lose work
- **Dark / light theme** — follows system or toggle manually
- **Tab key** inserts spaces (not focus-change)
- **Tab titles** auto-derive from first line of content, or double-click to rename
- **Char / word count** in the footer
- **Share as GitHub Gist** — creates a secret gist, auto-copies the raw URL

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + N` | New tab |
| `Ctrl/Cmd + W` | Close tab |
| `Ctrl/Cmd + S` | Share as Gist |

## Gist Sharing Setup

1. Create a GitHub Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens) with the **`gist`** scope
2. Open the extension sidebar → click the ⚙ gear icon → paste your token → Save

When you click **Share**, a secret gist is created and two URLs are provided:
- **Gist URL** — viewable on GitHub
- **Raw URL** — plain text, directly fetchable by LLMs or `curl`

## Tech

Vanilla HTML/CSS/JS. No build step, no framework, no dependencies. Manifest V3.
