# Dockarr - Project Specification

## Project Overview
**Goal**: Build a cross-platform desktop app for non-technical users to configure and manage Docker Compose services.
**Project Name**: Dockarr
**Services**: Prowlarr, Sonarr, Radarr, Plex, Transmission, Overseerr.
**Platforms**: macOS, Linux, Windows.
**Target Audience**: Non-technical users unfamiliar with Docker or YAML.
**Core Principle**: Abstract away YAML and `.env` complexity with a guided setup wizard and interactive management dashboard.

## Functional Requirements

### Initial Launch
- [x] **Task**: Check Docker and Docker Compose status on app start.
  - [x] If not installed/running: Show OS-specific install instructions (macOS, Linux, Windows).
  - [x] If running: Proceed to wizard (first run) or dashboard (post-setup).

### Setup Wizard
- [x] **Task**: Create a wizard to configure services.
  - **Services**: 
    - [x] Options: Prowlarr, Sonarr, Radarr, Plex, Transmission, Overseerr.
    - [x] Rules: All services are optional, minimum one service required.
  - **Settings**:
    - **File Paths** (required per service):
      - [x] Sonarr: TV shows path.
      - [x] Radarr: Movies path.
      - [x] Transmission: Downloads path.
      - [x] Plex: TV shows and movies paths.
      - [x] Prowlarr/Overseerr: Config directory only.
      - [x] Validate: Check existence and writability; auto-create if missing, error if fails.
      - [x] User Interaction: Present the user with file browser dialogs to select directories.
    - **Ports**:
      - [x] Customizable with defaults (Sonarr: 8989, Radarr: 7878, Plex: 32400, Transmission: 9091, Prowlarr: 9696, Overseerr: 5055).
      - [x] Validate: Range 1024-65535, no conflicts, error if invalid.
    - **Defaults**:
      - [x] TZ=UTC, PUID=1000, PGID=1000 (editable later).
  - **Summary**:
    - [x] Display services, paths, ports; allow back-edits, save via "Save and Apply".
  - **Re-Run**:
    - [x] Trigger from dashboard ("Edit Setup"), pre-populate from `config.json`, apply via "Save and Apply".

### Dashboard
- [x] **Task**: Build a dashboard for service management.
  - [x] **Initial Progress**: Show progress bar for service deployment (image pull, container start).
  - **Per Service** (Prowlarr, Sonarr, Radarr, Plex, Transmission, Overseerr):
    - [x] Launch: Link to web UI (e.g., `http://localhost:8989` for Sonarr).
    - [x] Restart: Button with progress indicator.
    - [x] Status: Display Running, Stopped, Starting.
    - [x] Version: Show current Docker image version.
    - [x] Update: Show if newer image available (weekly check), button to pull/run with progress.
    - [x] Logs: Show real-time logs.
    - [x] Alert: Subtle notification if service fails/crashes.
  - **Global Controls**:
    - [x] Stop All: Button, confirm ("Are you sure?"), progress indicator.
    - [x] Start All: Button, confirm ("Are you sure?"), progress indicator.
  - **Docker Check**:
    - [x] On launch, if installed but not running, auto-start; else, show error ("Failed to start Docker" or "Docker not installed").
  - **Docker Updates**:
    - [x] Weekly check, notify with link to instructions.

### Advanced Settings
- [x] **Task**: Add settings panel.
  - [x] Edit: Ports, PUID, PGID, TZ (apply immediately, update `.env`, restart service with progress).
  - [x] Reset: Delete `config.json`, `.env`, stop services, confirm prompt.

### Configuration
- [x] **Task**: Manage config files.
  - [x] Store: `config.json` (e.g., `~/.media-center/config.json` Linux/macOS, `%USERPROFILE%\.media-center\config.json` Windows).
  - [x] Generate: `.env`, `docker-compose.yml` from `config.json`.
  - [x] No export feature.

### Extensibility
- [x] **Task**: Design for future growth.
  - [x] Limit to 6 services now, modular for adding others (e.g., Deluge, Kodi).

### Runtime
- [x] **Task**: Define app behavior.
  - [x] Active only when launched (no background process).
  - [x] Docker/services run independently.

## Technical Stack

### Frontend
- **ReactJS (TypeScript)**:
  - Use: Build UI.
  - All custom code must be written in TypeScript for type safety and maintainability.
  - State: `useState`, `useReducer`, `useContext` (no Redux).
  - Context Providers: ThemeContext, ToastContext for global state management.
- **Flowbite + Custom Components**:
  - Use: Pre-designed components and Tailwind CSS styling.
  - Custom Components: Enhanced Button, Card, Badge, Modal, Toast, and layout components.
  - Dark Mode: Full dark mode support with Tailwind CSS dark: classes.

### Backend
- **Node.js (TypeScript)**:
  - Use: Server-side runtime.
  - All backend code must be written in TypeScript for type safety and maintainability.
- **Express**:
  - Use: API for frontend-backend communication.
- **node-docker-api**:
  - Use: Docker operations (start/stop, pull, status).
- **fs**:
  - Use: File ops (read/write `config.json`, `.env`, `docker-compose.yml`, create dirs).

### Async Management
- **Native Promises**:
  - Use: `async/await` for Docker calls, file ops (no extra libs).

### Packaging
- **Electron**:
  - Use: Package ReactJS frontend and Node.js backend into desktop app (macOS, Linux, Windows).

### Build Tooling
- **Vite**: Required bundler/build tool for this project, chosen for speed and maintainability.
- **Electron Builder**: Cross-platform packaging for macOS (DMG), Windows (NSIS), and Linux (AppImage).
- All code must pass TypeScript type checks and use static analysis tools (e.g., ESLint, Prettier) for code quality.
- **Testing**: Jest + React Testing Library for frontend, Jest + Supertest for backend.

## Implementation Notes
- **Default Ports**: Sonarr: 8989, Radarr: 7878, Plex: 32400, Transmission: 9091, Prowlarr: 9696, Overseerr: 5055.
- **Update Checks**: Weekly queries to Docker registry for service images and Docker's official channels for Docker/Docker Compose updates.
- **Logs**: Stream output from Docker Compose logs for each service via `node-docker-api`.
- **Paths**: Use platform-appropriate paths (e.g., `~/.media-center/` for Linux/macOS, `%USERPROFILE%\.media-center` for Windows).
- **UX**: Clear feedback (progress, alerts), safe actions (confirmations).

## Tasks for Code Generation
1. [x] **Setup Project**: Init Electron with ReactJS (frontend) and Node.js/Express (backend).
2. [x] **Wizard**: Build multi-step form with service selection, path/port inputs, validation, summary.
3. [x] **Dashboard**: Create service list with controls, global buttons, Docker status/update alerts.
4. [x] **Backend API**: Implement endpoints for Docker ops (start/stop/update/logs), file management.
5. [x] **Config**: Handle `config.json` read/write, generate `.env`, `docker-compose.yml`.
6. [x] **Packaging**: Configure Electron for cross-platform builds.
7. [x] **UI Enhancement**: Implement dark mode, toast notifications, confirmation modals.
8. [x] **Monitoring**: Runtime service monitoring, health checks, and status reporting.
9. [x] **Advanced Settings**: In-app configuration panel with validation and error handling.
10. [x] **Testing**: Comprehensive test suite with unit, integration, and component tests.

## User Experience Goals
- Simplify Docker Compose management with a guided wizard and interactive dashboard.
- Provide clear feedback via progress indicators, subtle alerts, and validated inputs.
- Ensure a safe, forgiving experience with confirmations for major actions (Stop All, Start All, Reset).

## Implemented Features (v1.0)
The following features have been successfully implemented:
- [x] **Dark Mode & Theming:** Light/dark theme toggle with system preference detection and localStorage persistence.
- [x] **Enhanced UI Components:** Custom components with Tailwind CSS including toasts, modals, badges, and responsive design.
- [x] **Runtime Monitoring:** Real-time service health monitoring, Docker status tracking, and automatic status updates.
- [x] **Service Management:** Start, stop, restart, update individual services with progress indicators and error handling.
- [x] **Logs & Diagnostics:** Real-time log viewing with drawer interface for each service.
- [x] **Advanced Configuration:** In-app settings panel for environment variables, ports, and service configuration.
- [x] **System Status Dashboard:** Collapsible system status showing Docker health, app runtime status, and service metrics.
- [x] **Cross-Platform Packaging:** Electron-based distribution with DMG (macOS), NSIS (Windows), and AppImage (Linux) support.
- [x] **Toast Notifications:** Context-based toast notification system for user feedback.
- [x] **Confirmation Dialogs:** Safety confirmations for destructive actions (stop all, reset configuration).

## Out of Scope / Not Supported (v1)
The following features are explicitly not supported in this release:
- **Authentication & User Management:** Single user only; no authentication, password protection, or multi-profile support.
- **Error Reporting & Diagnostics:** No error log export, diagnostics, or external error reporting; only in-app feedback as described.
- **App Updates:** No auto-update or self-update functionality; updates are performed manually by the user.
- **Localization:** English-only UI; no multi-language or i18n support.
- **Accessibility:** Accessibility (a11y) features (e.g., screen reader support, keyboard navigation standards) are deferred to a future release.
- **Import/Export:** No import/export or backup/restore of user settings or configuration files.
- **Notifications:** All notifications and alerts are strictly within the app UI; no desktop/system or external notifications.
- **Config Directory:** Configuration directory location is fixed (`~/.media-center/` on Linux/macOS, `%USERPROFILE%\.media-center` on Windows); not user-configurable.
- **Single Instance:** Only one configuration and set of services per user account; no multi-instance or profile support.
- **External Interfaces:** No API or CLI; all interaction is via the Electron app UI.
- **Plugin/Extension System:** No plugin or extension system; extensibility is internal only (future services added via app updates).
- **Analytics/Telemetry:** No analytics or telemetry; all data remains local except for Docker image/update checks.
- **File Selection:** Standard file browser dialog for directory selection; no drag-and-drop support.
- **Documentation:** No separate documentation or help resources; in-app guidance only (tooltips, inline instructions).
- **Automation/Scheduling:** All actions are manual; no scheduled or automated service actions.
- **Network Configuration:** Only port selection per service; no advanced network, proxy, or Docker network configuration.
- **Media Data Management:** No backup/migration of media data (TV shows, movies, downloads); user responsibility.
- **External Integrations:** No integration with external notification or messaging services (e.g., email, Slack, push notifications).
- **Environment Variables:** Only the environment variables listed in the UI are configurable; no advanced/custom variable support.

## Testing Strategy
A robust testing approach is required to ensure maintainability, reliability, and user confidence. The following strategy applies to both frontend and backend components:

### 1. Unit Testing
- **Frontend:**
  - [x] Use [Jest](https://jestjs.io/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for testing React components, hooks, and utility functions.
  - [x] Focus on component logic, state management, and input validation.
- **Backend:**
  - [x] Use [Jest](https://jestjs.io/) or [Mocha](https://mochajs.org/) with [Chai](https://www.chaijs.com/) for testing Node.js/Express services and utility modules.
  - [x] Mock Docker and filesystem interactions to isolate business logic.

### 2. Integration Testing
- **Frontend-Backend Integration:**
  - [x] Use [Supertest](https://github.com/ladjs/supertest) or similar tools to test API endpoints and their interaction with the backend logic.
  - [x] Validate correct data flow between frontend and backend, including error handling and edge cases.

### 3. End-to-End (E2E) Testing
- [x] Use [Playwright](https://playwright.dev/) or [Cypress](https://www.cypress.io/) to simulate real user workflows in the Electron app.
- [x] Cover critical flows: setup wizard, dashboard actions (start/stop/restart/update services), file path selection, and error scenarios.

### 4. Test Coverage & Best Practices
- [x] Target at least 80% code coverage for both frontend and backend.
- [x] Write tests for all critical logic, including validation, service management, and configuration file operations.
- [x] Use descriptive test names and organize tests by feature/module for maintainability.
- [x] Prefer testing user-visible behavior over implementation details.
- [x] Ensure tests are deterministic and do not depend on external Docker or filesystem state (use mocks/stubs where appropriate).

### 5. Continuous Integration (CI)
- [x] Integrate tests into the CI pipeline to run on every pull request and before releases.
- [x] Fail builds on test failures or insufficient coverage.

### 6. Manual Testing
- [x] Perform manual exploratory testing on all supported platforms (macOS, Linux, Windows) before major releases.
- [x] Validate platform-specific behaviors, file dialogs, and Docker interactions.

This strategy ensures the application remains reliable, maintainable, and user-friendly as it evolves.