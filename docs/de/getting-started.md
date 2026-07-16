# Erste Schritte

## Was du brauchst

Ensembler betreibt deine Dienste in Docker, daher benötigst du eine installierte
und laufende **Container-Laufzeitumgebung** — etwas, das die Befehle `docker`
und `docker compose` bereitstellt.

- **Empfohlen (am einfachsten):**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) — eine
  Ein-Klick-Installation für macOS, Windows und Linux. Falls du es nicht hast,
  verweist Ensembler dich beim ersten Start darauf.
- **Nutzt du bereits etwas anderes?** Jede Docker-kompatible Laufzeitumgebung
  funktioniert genauso gut — zum Beispiel **OrbStack** (macOS), **Podman**,
  **Rancher Desktop**, **colima** oder **Docker Engine** unter Linux. Solange
  `docker` und `docker compose` funktionieren, verwendet Ensembler sie.

Du brauchst **kein** Node.js, kein Terminal und keine Entwicklerwerkzeuge, um
die App zu nutzen.

## Erster Start

Wenn du Ensembler zum ersten Mal öffnest, prüft es, ob Docker läuft. Falls
Docker nicht installiert oder gestartet ist, siehst du Anweisungen, um das zu
beheben — starte Docker Desktop, warte, bis es meldet, dass es läuft, und
Ensembler fährt fort.

## Der Einrichtungsassistent

### 1. Wähle deine Dienste
Empfohlene Dienste sind für ein vollständiges Media Center bereits vorausgewählt.
Bei einigen Kategorien — Download-Client, Indexer-Manager und Anfragen — kannst
du eine einzige Option wählen; bei anderen — Medienserver und Medienverwaltung —
kannst du mehrere auswählen (zum Beispiel Plex und Jellyfin gleichzeitig
betreiben).

### 2. Lege deine Ordner fest
Sag Ensembler, wo deine **TV-Serien**, **Filme** und **Downloads** liegen. Das
sind deine eigenen Ordner — wähle Orte mit genügend Platz für deine Bibliothek.
Ports werden automatisch geprüft, und falls ein Standard-Port bereits belegt
ist, wählt Ensembler unauffällig einen freien für dich.

### 3. Anwenden
Ensembler erzeugt die Konfiguration, startet deine Dienste und verbindet sie
miteinander. Du siehst, wie jeder Schritt abgeschlossen wird.

## Einrichtung abschließen

Ein paar Schritte können nur von dir erledigt werden, und das Dashboard fordert
dich in einer Liste **"Einrichtung abschließen"** dazu auf:

- **Einen Indexer in Prowlarr hinzufügen** — damit Sonarr und Radarr nach
  Inhalten suchen können. Du wählst deine eigenen Quellen; Ensembler wählt sie
  nie für dich aus.
- **Bei Plex anmelden** — Ensembler erstellt dann automatisch deine TV- und
  Filmbibliotheken.
- **Overseerr abschließen** — es meldet sich bei Plex an und entdeckt deine
  anderen Dienste.

Jede Aufforderung hat einen **Öffnen**-Link, der dich direkt zur richtigen
Stelle bringt.

Jellyfin oder Emby? Diese stehen nicht in der Liste — Ensembler betreibt den
Container, aber jeder verwaltet seine eigene Ersteinrichtung. Öffne ihn vom
Dashboard aus und schließe die Einrichtung in seiner eigenen Weboberfläche ab
(erstelle dein Administrator-Konto und füge deine Bibliotheken hinzu).

Sobald das erledigt ist, bist du startklar.
