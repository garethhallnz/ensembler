# Troubleshooting

## "Docker is required" / Docker not running
Ensembler needs a container runtime running. If you use **Docker Desktop**,
start it and wait until it reports it's running (not just installed), and
Ensembler will continue. If it's not installed, follow the download link on that
screen. Using an alternative like **OrbStack** or **Podman**? That's fine too —
just make sure it's running and that `docker` and `docker compose` work.

## A service won't start
- Open the service's **⋯ menu → View logs** to see what it's complaining about.
- Try **⋯ menu → Restart**.
- Import notifications and library scans can take a minute while services finish
  starting up, so give it a moment after first launch.

## A warning about Docker memory or disk space
Ensembler warns when Docker has little memory allocated or the media disk is
nearly full — the two most common, invisible reasons services misbehave.
- **Memory:** raise it in your container runtime's settings (Docker Desktop →
  Settings → Resources); 4 GB or more is a good baseline for a few services.
- **Disk:** free up space on the drive your downloads/media use, or point
  services at a larger drive from their **Configure** screen.

## "Not Secure" warning when I open a service
Services now open **inside Ensembler** as tabs, so you shouldn't see this. It
only appears if you use a service's **⋯ menu → Open in browser** (or run
Ensembler in a web browser). Local services run over `http://localhost`, which
browsers label "Not Secure" — for a service on your own machine that's expected
and harmless; your data isn't leaving your computer.

## A port is already in use
Ensembler checks ports during setup and automatically picks a free one if a
default is taken, so this is rare. If a service still won't bind, another app may
have grabbed its port — stop that app, or change the port from the service's
**Configure** screen.

## Where is my data?
- **App configuration** lives in a hidden per-user folder (see *Managing your
  services → Where your settings live*). You don't need to edit it.
- **Your media** stays wherever you chose during setup and is never moved or
  deleted by Ensembler.

## Something is badly stuck — start fresh
**Settings → Danger zone → Reset everything** stops and removes all services and
their settings and returns Ensembler to a clean state. **Your media files are
not affected** — only services and their configuration are removed. You'll go
back through the setup wizard afterwards.

## Still stuck?
Grab the details from a service's **View logs** and from the **Diagnostics**
panel at the bottom of the dashboard — those are the most useful things to
include when reporting an issue.
