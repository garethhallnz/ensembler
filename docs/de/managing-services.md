# Deine Dienste verwalten

Alles passiert auf dem **Dashboard**. Jeder Dienst hat eine Karte, die seinen
Status und die verfügbaren Aktionen anzeigt.

## Dienstkarten

- Ein farbiger **Statuspunkt** zeigt dir den Zustand auf einen Blick:
  - **grün — Läuft**
  - **grau — Gestoppt**
  - **bernstein — Einrichtung erforderlich** oder **Aufmerksamkeit nötig**
- **Öffnen** öffnet den Dienst **innerhalb von Ensembler als Tab** — kein
  separater Browser und keine "Nicht sicher"-Warnung. Eine Leiste am oberen Rand
  lässt dich zwischen dem **Dashboard** und allen geöffneten Diensten wechseln
  und einen Tab mit seinem **✕** schließen. Sie hat außerdem eine Schaltfläche
  zum **Neuladen** und eine zum **Im-Browser-öffnen** für den aktuellen Dienst.
- Auf jeder laufenden Karte erscheint eine kleine **Version**. Ein **🔒 Schloss**
  bedeutet, dass der Dienst auf eine bestimmte Version festgelegt ist; die
  **↻**-Markierung bedeutet, dass er die neueste Version verfolgt. Sie wird
  bernsteinfarben, wenn ein Update verfügbar ist.
- Das **⋯ Menü** enthält den Rest: **Im Browser öffnen**, **Start / Stopp**,
  **Neu starten**, **Logs anzeigen**, **Nach Updates suchen** und
  **Konfigurieren**.

Während ein Dienst startet oder stoppt, zeigt der Status kurz
"Startet…/Stoppt…", damit du weißt, dass etwas passiert.

## Dienste hinzufügen und entfernen

- **Dienst hinzufügen** (oben im Bereich Dienste) lässt dich alles hinzufügen,
  was du während der Einrichtung nicht ausgewählt hast.
- Um einen Dienst zu entfernen, öffne sein **⋯ Menü → Konfigurieren**.

## Dienste aktuell halten

- Ensembler prüft unauffällig im Hintergrund, sodass verfügbare Updates von
  selbst erscheinen. Du kannst auch auf **Nach Updates suchen** klicken (oben im
  Bereich Dienste), um jetzt alles zu prüfen, oder einen einzelnen Dienst über
  sein **⋯ Menü → Nach Updates suchen** prüfen (das Ergebnis erscheint auf der
  Karte).
- Wenn Updates verfügbar sind, zeigt die Dienste-Überschrift, wie viele, und eine
  Schaltfläche **Alle aktualisieren** wendet sie in einem Rutsch an. Um nur einen
  zu aktualisieren, klicke auf der Karte auf **Update verfügbar — jetzt
  aktualisieren**. Deine Einstellungen bleiben erhalten.
- **Eine Version festlegen.** Standardmäßig verfolgt jeder Dienst die neueste
  Version. Um einen auf einer bestimmten Version zu halten, öffne
  **⋯ Menü → Konfigurieren** und wähle aus dem **Version**-Dropdown. Festgelegte
  Dienste zeigen ein 🔒 und bieten keine Updates mehr an.
- **Automatische Updates.** Aktiviere **Einstellungen → Updates → Updates
  automatisch installieren**, damit Ensembler verfügbare Updates im Hintergrund
  anwendet. Es ist standardmäßig ausgeschaltet, sodass du die Kontrolle behältst.

## Einstellungen

Öffne **Einstellungen** (oben rechts) für app-weite Optionen:

- **Erscheinungsbild** — Hell, Dunkel oder System (folgt deinem Betriebssystem).
- **Allgemein** — Ensembler in der Menüleiste / im System-Tray behalten, wenn du
  das Fenster schließt (standardmäßig aktiviert), sodass es einen Klick entfernt
  ist. Deine Dienste laufen so oder so weiter; nutze **Beenden** im Tray-Menü, um
  vollständig zu beenden.
- **Updates** — automatische Hintergrund-Updates für deine Dienste aktivieren
  (standardmäßig aus).
- **Umgebung** — Zeitzone und die für Dateiberechtigungen verwendeten
  Benutzer-/Gruppen-IDs.
- **Gefahrenzone → Alles zurücksetzen** — stoppt und entfernt alle Dienste und
  ihre Einstellungen und versetzt Ensembler in einen frisch installierten
  Zustand. **Deine Mediendateien werden nie angetastet** — nur die Dienste und
  ihre Konfiguration werden entfernt.

## Wo deine Einstellungen liegen

Ensembler speichert seine Konfiguration in einem versteckten benutzerspezifischen
Ordner (für dich verwaltet — du solltest ihn nicht bearbeiten müssen):

- **macOS:** `~/Library/Application Support/Ensembler`
- **Windows:** `%APPDATA%\Ensembler`
- **Linux:** `~/.config/Ensembler`

Deine **Mediendateien** (TV, Filme, Downloads) liegen dort, wo du es während der
Einrichtung gewählt hast, und sind davon getrennt.

## Diagnose

Am unteren Rand des Dashboards zeigt das **Diagnose**-Panel (standardmäßig
eingeklappt) den technischen Status — ob Docker läuft, wie viele Dienste aktiv
sind und so weiter. Normalerweise brauchst du es nicht, aber es ist bei der
Fehlerbehebung nützlich.
