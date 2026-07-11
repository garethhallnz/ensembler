# Managing your services

Everything happens on the **dashboard**. Each service has a card showing its
status and the actions you can take.

## Service cards

- A coloured **status dot** tells you the state at a glance:
  - **green — Running**
  - **grey — Stopped**
  - **amber — Setup needed** or **Needs attention**
- **Open** launches the service.
- The **⋯ menu** holds the rest: **Start / Stop**, **Restart**, **View logs**,
  **Check for updates**, and **Configure**.

While a service is starting or stopping, the status shows a brief
"Starting…/Stopping…" so you know something's happening.

## Adding and removing services

- **Add Service** (top of the Services section) lets you add anything you didn't
  choose during setup.
- To remove a service, open its **⋯ menu → Configure**.

## Keeping services up to date

- **Check for updates** (next to Add Service) checks every service at once.
  Ensembler also checks quietly in the background from time to time, so
  available updates appear on their own.
- To check a single service, use its **⋯ menu → Check for updates** — the result
  shows right on the card ("Up to date" or "Update available").
- When an update is available, click **Update available — update now** on the
  card to apply it. Your settings are preserved.

## Settings

Open **Settings** (top-right) for app-wide options:

- **Appearance** — Light, Dark, or System (follow your operating system).
- **Environment** — timezone and the user/group IDs used for file permissions.
- **Danger zone → Reset everything** — stops and removes all services and their
  settings, returning Ensembler to a fresh install. **Your media files are never
  touched** — only the services and their configuration are removed.

## Where your settings live

Ensembler stores its configuration in a hidden per-user folder (managed for
you — you shouldn't need to edit it):

- **macOS:** `~/Library/Application Support/Ensembler`
- **Windows:** `%APPDATA%\Ensembler`
- **Linux:** `~/.config/Ensembler`

Your **media files** (TV, movies, downloads) live wherever you chose during
setup and are separate from this.

## Diagnostics

At the bottom of the dashboard, the **Diagnostics** panel (collapsed by default)
shows technical status — whether Docker is running, how many services are up,
and so on. You won't normally need it, but it's handy when troubleshooting.
