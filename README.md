# connectX

a small place to connect

ConnectX is an original social and community platform being built desktop-first for Windows and Linux, with a web version planned later.

## Current status

This repository contains the first desktop application scaffold and an interactive UI prototype.

- Original dark visual identity
- Space and channel navigation mockup
- Direct-message list mockup
- Local in-window message composer
- Electron desktop shell with context isolation, sandboxing, and Node integration disabled

**Not implemented yet:** accounts, persistent messages, networking, real-time presence, friends, invitations, or moderation. The starter messages are demo data and messages sent in the UI are not saved.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run in development

```bash
npm install
npm run dev
```

## Build the web renderer

```bash
npm run build
```

## Project layout

- `electron/` — desktop main process and preload
- `src/` — React interface
- `index.html` — Vite entry point

## Planned milestones

1. Establish the desktop UI and navigation
2. Add a backend API and database
3. Implement accounts and profiles
4. Add spaces, channels, and persistent messaging
5. Add friends, direct messages, and real-time presence
6. Add moderation, privacy controls, and packaging for Windows/Linux

## Design direction

ConnectX uses an original visual identity: compact navigation, restrained purple accents, clean typography, and a calm dark interface. It takes inspiration from community chat apps without copying their branding or exact layout.