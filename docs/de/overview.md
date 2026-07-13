# Was ist Ensembler?

Ensembler richtet ein **Home Media Center** für dich ein und betreibt es — den
beliebten "*arr"-Stack (Sonarr, Radarr, Prowlarr und Co.) sowie einen
Medienserver wie Plex oder Jellyfin — ohne dass du Docker, YAML oder die
Kommandozeile kennen musst.

Du wählst die gewünschten Dienste aus, Ensembler installiert sie, startet sie,
verbindet sie miteinander und bietet dir ein einziges Dashboard, um alles zu
verwalten.

## So funktioniert es

Im Hintergrund läuft jeder Dienst in seinem eigenen **Docker-Container**.
Ensembler erzeugt die Docker-Konfiguration, startet die Container und verbindet
sie miteinander, sodass sie als ein System zusammenarbeiten. Du musst nie eine
Konfigurationsdatei anfassen.

Der typische Ablauf ist:

1. **Einrichtungsassistent** — wähle deine Dienste, zeige Ensembler deine
   Medienordner und klicke auf **Anwenden**. Ports werden für dich geprüft, und
   freie Ports werden automatisch gewählt, falls ein Standard belegt ist.
2. **Automatische Verkabelung** — Sonarr und Radarr erhalten ihren
   Download-Client und ihre Ordner, Prowlarr verknüpft sich mit ihnen,
   Medienserver bekommen Import-Benachrichtigungen und so weiter. Du siehst,
   wie jeder Schritt abgeschlossen wird.
3. **Dashboard** — von da an verwaltest du alles an einem Ort: öffne einen
   Dienst, starte/stoppe ihn, suche nach Updates oder füge weitere Dienste hinzu.

## Was die Dienste tun

| Dienst | Rolle |
|---|---|
| **Sonarr** | Verwaltet deine TV-Serien |
| **Radarr** | Verwaltet deine Filme |
| **Bazarr** | Verwaltet Untertitel für Sonarr/Radarr |
| **Plex / Jellyfin / Emby** | Streamen deine Medien auf deine Geräte |
| **Transmission / Deluge** | Download-Clients |
| **Prowlarr / Jackett** | Verwalten, wo deine Dienste nach Inhalten suchen |
| **Overseerr** | Medien anfragen und entdecken |

## Was Ensembler tut — und was nicht

Ensembler **verbindet deine Dienste miteinander**. Es wählt, fragt oder lädt
**keine** Inhalte aus, und es konfiguriert **keine** Indexer oder Tracker für
dich. Du wählst deine eigenen Quellen und bist dafür verantwortlich, wie du sie
nutzt.
