# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dockarr** is an Electron-based desktop application that simplifies the setup and management of home media center services (Sonarr, Radarr, Plex, Transmission, Prowlarr, Overseerr). It provides a guided setup wizard and unified dashboard for Docker-based media services without requiring Docker/YAML expertise.

## Architecture

### Core Structure
- **Root**: Electron main process (`electron.js`) and build scripts
- **Backend** (`backend/`): Express.js API server with Docker integration
- **Frontend** (`frontend/`): React + TypeScript + Vite with Tailwind CSS and Flowbite components
- **Configuration**: Stored in `~/.media-center/` with `config.json`, `.env`, and `docker-compose.yml`

### Key Components
- **SetupWizard**: Service selection, path configuration, and Docker Compose generation
- **Dashboard**: Service monitoring, control (start/stop/restart), and health checks
- **RuntimeManager**: Backend communication and service state management
- **ServiceConfig**: Centralized service definitions and Docker image management

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Flowbite React
- **Backend**: Express.js, TypeScript, node-docker-api
- **Desktop**: Electron with preload scripts and context isolation
- **Testing**: Jest for both frontend (jsdom) and backend (node)

## Development Commands

### Installation and Setup
```bash
# Install all dependencies (root, frontend, backend)
npm run install-deps

# Development mode (Electron app)
npm run dev

# Alternative: Browser development
cd backend && npm run dev  # Terminal 1: Backend on :3001
cd frontend && npm run dev # Terminal 2: Frontend on :5173
```

### Building and Testing
```bash
# Full production build (creates Electron app in dist-electron/)
./build.sh           # Linux/macOS
build.bat            # Windows

# Backend only
cd backend
npm run build        # TypeScript compilation
npm test            # Jest tests
npm run dev         # Development with nodemon

# Frontend only  
cd frontend
npm run build       # Vite production build
npm test           # Jest + React Testing Library
npm run lint       # ESLint
npm run dev        # Vite dev server
```

### Testing
- **Backend**: Jest with TypeScript, includes API integration tests with Docker mocks
- **Frontend**: Jest + jsdom + React Testing Library, component unit tests
- **Full test suite**: `npm test` (runs both backend and frontend tests)

## Configuration Management

### Service Configuration
- Services defined in `backend/src/services/serviceConfig.ts`
- Each service has: ports, environment variables, Docker image, dependencies
- Default paths automatically configured per platform (Windows/Linux/macOS)

### Environment and State
- User config stored in platform-specific `~/.media-center/` directory
- Runtime state managed through `RuntimeManager` class
- Theme preferences and application state persisted locally

## Key Development Patterns

### Frontend Architecture
- Context-based state management (Theme, Toast notifications)
- Component library in `frontend/src/components/` with consistent styling
- Service communication through `runtimeManager` abstraction
- Toast notifications for user feedback and error handling

### Backend API Design
- RESTful endpoints for Docker operations, service management, system status
- Docker API integration with error handling and validation
- Configuration file management with atomic updates
- Real-time service health monitoring and update checking

### Cross-Platform Considerations
- Platform-specific path defaults and configuration directories
- Electron context isolation with secure preload scripts
- OS-specific Docker installation instructions and validation