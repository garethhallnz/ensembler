# Getting started

## What you need

Ensembler runs your services in Docker, so you need a **container runtime**
installed and running — something that provides the `docker` and
`docker compose` commands.

- **Recommended (easiest):**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) — a one-click
  install for macOS, Windows, and Linux. If you don't have it, Ensembler points
  you to it on first launch.
- **Already use something else?** Any Docker-compatible runtime works just as
  well — for example **OrbStack** (macOS), **Podman**, **Rancher Desktop**,
  **colima**, or **Docker Engine** on Linux. As long as `docker` and
  `docker compose` work, Ensembler will use them.

You do **not** need Node.js, a terminal, or any developer tools to use the app.

## First launch

When you open Ensembler for the first time it checks that Docker is running. If
Docker isn't installed or started, you'll see instructions to fix that — start
Docker Desktop, wait for it to say it's running, and Ensembler will continue.

## The setup wizard

### 1. Choose your services
Recommended services are pre-selected for a complete media center. Some
categories — download client, indexer manager, and requests — let you pick a
single option; others — **media servers** and **media management** — let you
choose several (for example, run both Plex and Jellyfin).

### 2. Set your folders
Tell Ensembler where your **TV shows**, **movies**, and **downloads** live.
These are your own folders — pick locations with enough space for your library.
Ports are checked automatically, and if a default port is already in use,
Ensembler quietly picks a free one for you.

### 3. Apply
Ensembler generates the configuration, starts your services, and connects them
together. You'll see each step complete.

## Finishing setup

A few steps can only be done by you, and the dashboard will prompt you for them
in a **"Finish setting up"** list:

- **Add an indexer in Prowlarr** — so Sonarr and Radarr can search for content.
  You choose your own sources; Ensembler never picks these for you.
- **Sign in to Plex** — Ensembler then creates your TV and Movies libraries
  automatically.
- **Finish Overseerr** — it signs in with Plex and discovers your other services.

Each prompt has an **Open** link that takes you straight to the right place.

**Jellyfin or Emby?** These aren't in the list — Ensembler runs the container,
but each manages its own first-run. Open it from the dashboard and complete its
setup in its own web interface (create your admin account and add your libraries).

Once those are done, you're up and running.
