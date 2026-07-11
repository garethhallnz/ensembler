# What is Ensembler?

Ensembler sets up and runs a **home media center** for you — the popular
"*arr" stack (Sonarr, Radarr, Prowlarr and friends) plus a media server like
Plex or Jellyfin — without you needing to know Docker, YAML, or the command
line.

You pick the services you want, Ensembler installs them, starts them, wires them
together, and gives you a single dashboard to manage everything.

## How it works

Under the hood, each service runs in its own **Docker container**. Ensembler
generates the Docker configuration, starts the containers, and connects them to
each other so they work as one system. You never have to touch a config file.

The typical journey is:

1. **Setup wizard** — choose your services, point Ensembler at your media
   folders, and click **Apply**. Ports are checked for you, and free ones are
   picked automatically if a default is taken.
2. **Automatic wiring** — Sonarr and Radarr get their download client and
   folders, Prowlarr links to them, media servers get import notifications, and
   so on. You watch each step complete.
3. **Dashboard** — from then on you manage everything from one place: open a
   service, start/stop it, check for updates, or add more services.

## What the services do

| Service | Role |
|---|---|
| **Sonarr** | Manages your TV shows |
| **Radarr** | Manages your movies |
| **Bazarr** | Manages subtitles for Sonarr/Radarr |
| **Plex / Jellyfin / Emby** | Stream your media to your devices |
| **Transmission / Deluge** | Download clients |
| **Prowlarr / Jackett** | Manage where your services search for content |
| **Overseerr** | Request and discover media |

## What Ensembler does — and doesn't do

Ensembler **connects your services together**. It does **not** select, request,
or download any content, and it does **not** configure indexers or trackers for
you. You choose your own sources and are responsible for how you use them.
