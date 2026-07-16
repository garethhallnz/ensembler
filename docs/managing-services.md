# Managing your services

Everything happens on the **dashboard**. Each service has a card showing its
status and the actions you can take.

## Service cards

- A coloured **status dot** tells you the state at a glance:
  - **green — Running**
  - **grey — Stopped**
  - **amber — Setup needed** or **Needs attention**
- **Open** opens the service **inside Ensembler as a tab** — no separate browser,
  and no "Not Secure" warning. A bar along the top lets you switch between the
  **Dashboard** and any open services, and close a tab with its **✕**. It also has
  a **reload** and an **open-in-browser** button for the current service.
- A small **version** appears on each running card. A **🔒 lock** means the service
  is pinned to a specific version; the **↻** marker means it tracks the latest.
  It turns amber when an update is available.
- The **⋯ menu** holds the rest: **Open in browser**, **Start / Stop**,
  **Restart**, **View logs**, **Check for updates**, and **Configure**.

While a service is starting or stopping, the status shows a brief
"Starting…/Stopping…" so you know something's happening.

## Adding and removing services

- **Add service** (top of the Services section) lets you add anything you didn't
  choose during setup, grouped by category so it's easy to find.
- To remove a service, open its **⋯ menu → Configure**.

Both here and on the dashboard, services are grouped by category (media servers,
media management, download clients, and so on).

## Keeping services up to date

- Ensembler checks quietly in the background, so available updates appear on
  their own. You can also click **Check for updates** (top of the Services
  section) to check everything now, or check one service via its
  **⋯ menu → Check for updates** (the result shows on the card).
- When updates are available, the Services header shows how many, and an
  **Update all** button applies them in one go. To update just one, click
  **Update available — update now** on its card. Your settings are preserved.
- **Pin a version.** By default each service tracks the latest version. To hold
  one at a specific version, open **⋯ menu → Configure** and choose from the
  **Version** dropdown. Pinned services show a 🔒 and stop offering updates.
- **Automatic updates.** Turn on **Settings → General → Install updates
  automatically** to have Ensembler apply available updates in the background.
  It's off by default, so you stay in control.

## Settings

Open **Settings** (top-right) for app-wide options, organised into sections:

- **Appearance** — theme (Light, Dark, or System) and language.
- **General** — keep Ensembler in the menu bar / system tray when you close the
  window (on by default; your services keep running either way — use **Quit** in
  the tray menu to exit fully), install service updates automatically (off by
  default), and your timezone.
- **Advanced** — technical detail you won't normally need: diagnostics (whether
  Docker is running, how many services are up), free disk and memory, and the
  user/group IDs used for file permissions.
- **Reset → Reset everything** — stops and removes all services and their
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

Technical status — whether Docker is running, how many services are up, and how
much disk and memory are free — lives under **Settings → Advanced**. You won't
normally need it, but it's handy when troubleshooting.
