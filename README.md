# Ensembler

**Ensembler** is a cross-platform desktop app that makes it easy to set up and run a home media center — Sonarr, Radarr, Plex, Jellyfin, Prowlarr, and more — without needing to know Docker, YAML, or the command line.

You pick the services you want, Ensembler installs and starts them, wires them together, and gives you one dashboard to manage everything.

## What you need

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**, installed and running. That's it — Ensembler guides you through installing Docker if you don't have it.

You do **not** need Node.js, a terminal, or any developer tools to use the app. (Those are only needed to build it from source — see below.)

## Install

1. Download the app for your system from the Releases page:
   - macOS — `.dmg`
   - Windows — `.exe` installer
   - Linux — `.AppImage`
2. Open it. On first launch Ensembler checks that Docker is running and walks you through setup.

## How it works

1. **Choose your services.** A short wizard lets you select what you want (media servers, TV/movie managers, a download client, an indexer manager, requests). Recommended services are pre-selected.
2. **Set your folders.** Point Ensembler at where your TV shows, movies, and downloads live. Ports are checked for you and free ones are chosen automatically if a default is taken.
3. **Apply.** Ensembler generates the Docker configuration, starts the services, and **connects them to each other automatically** — Sonarr/Radarr get their download client and folders, Prowlarr links to them, media servers get import notifications, and so on. You watch each step complete.
4. **Finish the few things only you can do.** The dashboard prompts you for the handful of steps that require a personal choice or account:
   - **Add an indexer** in Prowlarr (you choose your own sources — Ensembler never picks these for you).
   - **Sign in to Plex** (Ensembler then creates your TV and Movies libraries automatically). Jellyfin needs no sign-in — it's set up entirely for you.
   - **Finish Overseerr** setup (it signs in with Plex and discovers your services).
5. **Manage everything from the dashboard.** Each service has a card showing its status, an **Open** button, start/stop, and a menu for logs, restart, and per-service configuration. Add more services any time, and check for updates with one click.

> **What Ensembler does and doesn't do:** Ensembler connects your services together. It never selects, requests, or downloads any content, and it never configures indexers or trackers for you — you choose your own sources and are responsible for how you use them.

## Supported services

| Service | Role |
|---|---|
| Sonarr | Manages your TV shows |
| Radarr | Manages your movies |
| Bazarr | Manages subtitles |
| Plex | Streams your media |
| Jellyfin | Streams your media (fully open-source) |
| Emby | Streams your media |
| Transmission | Downloads content |
| Deluge | Downloads content |
| Prowlarr | Finds content sources (indexer manager) |
| Jackett | Finds content sources |
| Overseerr | Requests & discovers media |

## Where your settings live

- Configuration is stored in `~/.media-center/` (macOS/Linux) or `%USERPROFILE%\.media-center\` (Windows).
- Ensembler manages `config.json`, `.env`, and `docker-compose.yml` for you, plus each service's own data folder.
- **Your media files are never touched by Ensembler** — including when you reset. Resetting only removes the services and their settings.

## Troubleshooting

- **Docker not running:** Ensembler detects this and shows you how to start or install Docker.
- **A service won't start after setup:** open its card's menu → View logs. Import notifications and library scans can take a minute while services finish starting.
- **Port already in use:** Ensembler picks a free port automatically during setup and tells you.

---

## Building from source (developers)

Requirements: [Node.js](https://nodejs.org/) 20+, npm, and Docker.

```bash
git clone https://github.com/garethhallnz/media-center.git
cd media-center
npm run install-deps
```

Run in development (Electron desktop window, backend auto-starts):

```bash
npm run dev
```

Or run the pieces separately in the browser:

```bash
npm run backend    # backend API on http://localhost:3001
npm run frontend   # frontend on http://localhost:5180
```

Build a distributable desktop app:

```bash
./build.sh      # macOS/Linux
build.bat       # Windows
```

The packaged app lands in `dist-electron/`. The backend is bundled into a single file and run with Electron's own Node runtime, so end users need no Node installation.

### Tests

```bash
cd backend && npm test     # backend unit + integration tests
cd frontend && npm test    # frontend (add tests as the suite grows)
```

## Contributing

Pull requests and issues are welcome.

## License

MIT

---

**Ensembler** — the easiest way to run your *arr stack.
