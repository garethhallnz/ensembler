# Dockarr

**Dockarr** is a cross-platform desktop app that makes it easy to configure, deploy, and manage your home media center stack—no Docker or YAML expertise required.

## Features

- **Guided Setup Wizard:**  
  Select your preferred services (Sonarr, Radarr, Plex, Transmission, Prowlarr, Overseerr), set up file paths, and customize ports with real-time validation.
- **One-Click Deploy:**  
  Dockarr generates and manages all Docker Compose and environment files for you.
- **Unified Dashboard:**  
  Monitor, start, stop, restart, and update all your media services from a single interface.
- **Service Health & Logs:**  
  View real-time status, logs, and version info for each service. Get notified of failures or updates.
- **Advanced Settings:**  
  Edit environment variables (TZ, PUID, PGID, ports) and reset your configuration at any time.
- **Dark Mode Support:**  
  Toggle between light and dark themes with system preference detection.
- **System Monitoring:**  
  Real-time Docker status, service health monitoring, and update notifications.
- **Cross-Platform:**  
  Works on Windows, macOS, and Linux. Electron-powered desktop experience.

## Quick Start (Recommended: Desktop App)

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) & Docker Compose

### Installation

```bash
git clone https://github.com/garethhallnz/media-center.git
cd media-center

# Install all dependencies
npm run install-deps
```

### Running Dockarr as a Desktop App (Electron)

```bash
npm run dev
```

- The app will open as a native desktop window with dark mode support.
- All features are available in the desktop app.
- Backend automatically starts and integrates with the Electron frontend.

### Building for Production (Desktop App)

```bash
# On Linux/macOS
./build.sh

# On Windows
build.bat
```

The packaged app will be in `dist-electron/`.

---

## (Alternative) Local Development in Browser

If you want to run the frontend and backend separately in your browser (for development or debugging):

Open two terminals:

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## How It Works

1. **First Launch:**  
   Dockarr checks for Docker and guides you through installing it if needed.
2. **Setup Wizard:**  
   Choose your services, set media paths, and assign ports. Dockarr validates everything and generates the required config files.
3. **Dashboard:**  
   Start, stop, restart, update, and monitor all your services. Access each service’s web UI with one click.
4. **Advanced Settings:**  
   Change environment variables or reset your setup at any time.

## Supported Services

- **Sonarr:** TV show management
- **Radarr:** Movie management
- **Plex:** Media server
- **Transmission:** BitTorrent client
- **Prowlarr:** Indexer aggregator
- **Overseerr:** Request management

## Configuration & Storage

- All settings are stored in `~/.media-center/` (Linux/macOS) or `%USERPROFILE%\.media-center\` (Windows).
- Dockarr manages `config.json`, `.env`, and `docker-compose.yml` for you.
- Theme preferences and application state are automatically saved.
- Service configurations and paths are validated before saving.

## Testing

```bash
# Run all tests
npm test

# Backend tests (includes API and integration tests)
cd backend
npm test

# Frontend tests (includes component and unit tests)
cd frontend
npm test
```

## Troubleshooting

- **Docker not running:** Dockarr will prompt you to start or install Docker.
- **Port conflicts:** Use Advanced Settings to resolve.
- **Permission issues:** Ensure Docker has access to your media directories.

## Contributing

Pull requests and issues are welcome! Please see the code style and contribution guidelines in the repo.

## License

MIT

---

**Dockarr** – The easiest way to run your *arr stack.



## Additional Notes

### Service Configuration

Once Dockarr has deployed your services, you may want to configure them:

- **Plex**: Create libraries for your TV shows and movies
- **Sonarr/Radarr**: Add indexers and configure quality profiles
- **Transmission**: Configure download settings
- **Prowlarr**: Configure indexers to use with Sonarr/Radarr
- **Overseerr**: Connect to Plex and configure request settings

Each service has its own web interface accessible from the Dockarr dashboard.