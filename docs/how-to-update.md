# How to update Ensembler

This page is about updating **Ensembler itself** — the app. (For keeping your
*services* like Sonarr and Plex up to date, see **Managing services →
Keeping services up to date**.)

## How you'll know there's an update

Ensembler checks now and then whether a newer version has been released, and
shows a small notice on the dashboard when one is available. You can also check
any time in **Settings → General → Check for updates**.

Ensembler never installs a new version by itself — updating is a quick manual
step, and it's the same idea on every platform: **download the latest version
and open it**. Your services and settings are left completely alone.

## Updating

1. Open the **[Releases page](https://github.com/garethhallnz/ensembler/releases)**
   (the update notice links straight there).
2. Download the file for your system, then install it over your current copy:

   - **macOS** — download the `.dmg`, open it, and drag **Ensembler** into your
     **Applications** folder, replacing the old one. The first time you open the
     new version, right-click (or Control-click) the app and choose **Open**.
   - **Windows** — download the `.exe` and run it. It installs over your existing
     version. If Windows shows a "Windows protected your PC" screen, click
     **More info → Run anyway**.
   - **Linux** — download the new `.AppImage` and replace the old one. You may
     need to mark it executable again (right-click → **Properties →
     Permissions**, or `chmod +x` in a terminal).

3. Open Ensembler. That's it — your services keep running throughout, and all
   your settings are exactly as you left them.

## Turning the notice off

If you'd rather not see update notices, turn off **Settings → General → Update
notifications**. You can still check manually whenever you like with the
**Check for updates** button.

> **Why updating is manual:** it keeps Ensembler simple and consistent across
> macOS, Windows, and Linux, and means the app never changes itself behind your
> back. Your media files are never affected by an update.
