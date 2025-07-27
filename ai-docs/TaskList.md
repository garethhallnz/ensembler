# Task List for Docker Compose Service Manager UI (Test-First Approach, TypeScript)

## Section 1: Initial Setup
1.1 [x] Initialize Electron project with ReactJS (TypeScript) (frontend) and Node.js/Express (TypeScript) (backend)
1.2 [x] Set up TypeScript configuration for both frontend and backend (tsconfig.json)
1.3 [x] Configure build tooling with Vite (required) for both frontend and backend
1.4 [x] Set up ESLint and Prettier for static analysis and code formatting
1.5 [x] Set up cross-platform build for macOS, Linux, Windows

## Section 2: Docker & Environment Checks
2.1 [x] Write unit and integration tests (TypeScript) for Docker and Docker Compose installation/running status checks
2.2 [x] Implement Docker and Docker Compose installation/running status checks on app startup (TypeScript)
2.3 [x] Write E2E tests for OS-specific installation instructions and error handling
2.4 [x] Implement UI to display OS-specific installation instructions if Docker is not installed/running (TypeScript)
2.5 [x] Write unit/integration tests for auto-start Docker logic and error handling (TypeScript)
2.6 [x] Implement auto-start Docker if installed but not running; show error if unsuccessful (TypeScript)

## Section 3: Setup Wizard
3.1 [x] Write unit and E2E tests (TypeScript) for multi-step wizard navigation and validation
3.2 [x] Build multi-step wizard for service configuration (TypeScript)
3.3 [x] Write unit/integration tests for service selection logic (including validation: at least Sonarr or Radarr required) (TypeScript)
3.4 [x] Implement service selection (Prowlarr, Sonarr, Radarr, Plex, Transmission, Overseerr) (TypeScript)
3.5 [x] Write unit/integration tests for file path selection, validation, and auto-creation (TypeScript)
3.6 [x] Implement file path selection for each service with validation and auto-creation if missing (TypeScript)
3.7 [x] Write unit/integration tests for port number configuration and validation (range, conflicts) (TypeScript)
3.8 [x] Implement port number configuration (TypeScript)
3.9 [x] Write unit/integration tests for default environment variable handling (TypeScript)
3.10 [x] Set default environment variables (TZ=UTC, PUID=1000, PGID=1000) (TypeScript)
3.11 [x] Write E2E tests for summary page, back-editing, and "Save and Apply" flow (TypeScript)
3.12 [x] Create summary page showing selected services, paths, and ports with back-editing (TypeScript)
3.13 [x] Implement "Save and Apply" to generate `config.json`, `.env`, and `docker-compose.yml` (TypeScript)
3.14 [x] Write E2E tests for "Edit Setup" button and wizard re-run with pre-populated settings (TypeScript)
3.15 [x] Add "Edit Setup" button in dashboard to re-run wizard (TypeScript)

## Section 4: Dashboard
4.1 [x] Write E2E tests for dashboard UI, service management, and progress indicators (TypeScript)
4.2 [x] Build dashboard UI for service management (TypeScript)
4.3 [x] Write unit/integration tests for service deployment progress bar logic (TypeScript)
4.4 [x] Show progress bar for initial service deployment (TypeScript)
4.5 [x] For each service:
  4.5.1 [x] Write unit/integration tests for web UI link, restart, status, version, update, log, and alert logic (TypeScript)
  4.5.2 [x] Implement clickable link to launch service web UI (TypeScript)
  4.5.3 [x] Add restart button with progress indicator (TypeScript)
  4.5.4 [x] Show current status (Running, Stopped, Starting) (TypeScript)
  4.5.5 [x] Display current Docker image version (TypeScript)
  4.5.6 [ ] Check weekly for available updates and provide update button with progress indicator (TypeScript)
  4.5.7 [x] Implement real-time log viewing (TypeScript)
  4.5.8 [ ] Show subtle alert if service fails or crashes (TypeScript)
4.6 [x] Write E2E tests for global controls (Stop All, Start All) and confirmation flows (TypeScript)
4.7 [x] Implement global controls: "Stop All" and "Start All" buttons with confirmation and progress indicators (TypeScript)
4.8 [x] Write unit/integration tests for Docker status check and auto-start logic (TypeScript)
4.9 [x] Implement Docker status check on launch with auto-start if needed (TypeScript)
4.10 [ ] Write unit/integration tests for weekly Docker and Docker Compose update checks and notifications (TypeScript)
4.11 [ ] Implement weekly Docker and Docker Compose update checks with notification (TypeScript)

## Section 5: Advanced Settings
5.1 [x] Write unit/integration tests for settings panel logic and immediate application of changes (TypeScript)
5.2 [x] Create settings panel for editing ports, PUID, PGID, TZ, etc. (TypeScript)
5.3 [x] Implement immediate application of changes (update `.env`, restart affected service, show progress) (TypeScript)
5.4 [x] Write E2E tests for "Reset" option and confirmation prompt (TypeScript)
5.5 [x] Add "Reset" option to clear all settings (delete `config.json`, `.env`, stop all services) with confirmation (TypeScript)

## Section 6: Configuration Storage
6.1 [x] Write unit/integration tests for config file storage and generation logic (TypeScript)
6.2 [x] Store settings in `config.json` (`~/.media-center/config.json` on Linux/macOS, `%USERPROFILE%\.media-center\config.json` on Windows) (TypeScript)
6.3 [x] Generate `.env` and `docker-compose.yml` from `config.json` as needed (TypeScript)

## Section 7: Testing (Meta)
7.1 [ ] Set up unit testing for frontend (Jest, React Testing Library) and backend (Jest/Mocha, Chai) with TypeScript support
7.2 [ ] Set up integration testing for frontend-backend communication (Supertest) with TypeScript support
7.3 [ ] Set up end-to-end testing (Playwright or Cypress) for critical user flows (TypeScript)
7.4 [ ] Target at least 80% code coverage for both frontend and backend
7.5 [ ] Integrate tests into CI pipeline to run on every pull request and before releases
7.6 [ ] Perform manual exploratory testing on all supported platforms

## Section 8: Packaging & Distribution
8.1 [ ] Write E2E tests for packaged app startup and cross-platform behavior (TypeScript)
8.2 [ ] Configure Electron for cross-platform builds (TypeScript)
8.3 [ ] Ensure all dependencies and configurations are correctly bundled

## Section 9: User Experience & Compliance
9.1 [ ] Write E2E tests for feedback (progress indicators, alerts, validated inputs) (TypeScript)
9.2 [ ] Ensure clear feedback via progress indicators, subtle alerts, and validated inputs (TypeScript)
9.3 [ ] Write E2E tests for confirmations on major actions (Stop All, Start All, Reset) (TypeScript)
9.4 [ ] Implement confirmations for major actions (TypeScript)
9.5 [ ] Verify that all out-of-scope features are not implemented (see Out of Scope section in spec)

## Section 10: Final Review
10.1 [ ] Conduct a final review to ensure all tasks are completed and the application meets the specification
10.2 [ ] Verify cross-platform compatibility and user experience 