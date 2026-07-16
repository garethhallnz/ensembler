# Fehlerbehebung

## "Docker wird benötigt" / Docker läuft nicht
Ensembler benötigt eine laufende Container-Laufzeitumgebung. Wenn du **Docker
Desktop** nutzt, starte es und warte, bis es meldet, dass es läuft (nicht nur
installiert), und Ensembler fährt fort. Falls es nicht installiert ist, folge
dem Download-Link auf diesem Bildschirm. Nutzt du eine Alternative wie
**OrbStack** oder **Podman**? Das ist auch in Ordnung — stelle nur sicher, dass
sie läuft und dass `docker` und `docker compose` funktionieren.

## Ein Dienst startet nicht
- Öffne das **⋯ Menü → Logs anzeigen** des Dienstes, um zu sehen, worüber er sich
  beschwert.
- Versuche **⋯ Menü → Neu starten**.
- Import-Benachrichtigungen und Bibliotheks-Scans können eine Minute dauern,
  während die Dienste den Start abschließen, gib ihm also nach dem ersten Start
  einen Moment.

## Eine Warnung über Docker-Speicher oder Festplattenplatz
Ensembler warnt, wenn Docker wenig Speicher zugewiesen bekommen hat oder die
Medienfestplatte fast voll ist — die zwei häufigsten, unsichtbaren Gründe, warum
Dienste sich seltsam verhalten.
- **Speicher:** Erhöhe ihn in den Einstellungen deiner Container-Laufzeitumgebung
  (Docker Desktop → Settings → Resources); 4 GB oder mehr sind eine gute Basis
  für ein paar Dienste.
- **Festplatte:** Schaffe Platz auf dem Laufwerk, das deine Downloads/Medien
  nutzen, oder verweise die Dienste über ihren **Konfigurieren**-Bildschirm auf
  ein größeres Laufwerk.

## "Nicht sicher"-Warnung, wenn ich einen Dienst öffne
Dienste öffnen sich jetzt **innerhalb von Ensembler** als Tabs, daher solltest du
das nicht sehen. Es erscheint nur, wenn du das **⋯ Menü → Im Browser öffnen**
eines Dienstes nutzt (oder Ensembler in einem Webbrowser ausführst). Lokale
Dienste laufen über `http://localhost`, was Browser als "Nicht sicher"
kennzeichnen — für einen Dienst auf deinem eigenen Rechner ist das erwartet und
harmlos; deine Daten verlassen deinen Computer nicht.

## Ein Port ist bereits belegt
Ensembler prüft Ports während der Einrichtung und wählt automatisch einen freien,
falls ein Standard belegt ist, daher ist das selten. Falls sich ein Dienst
trotzdem nicht binden lässt, hat vielleicht eine andere App seinen Port belegt —
stoppe diese App oder ändere den Port über den **Konfigurieren**-Bildschirm des
Dienstes.

## Wo sind meine Daten?
- **App-Konfiguration** liegt in einem versteckten benutzerspezifischen Ordner
  (siehe *Deine Dienste verwalten → Wo deine Einstellungen liegen*). Du musst ihn
  nicht bearbeiten.
- **Deine Medien** bleiben dort, wo du sie während der Einrichtung gewählt hast,
  und werden von Ensembler nie verschoben oder gelöscht.

## Etwas hängt völlig fest — neu anfangen
**Einstellungen → Zurücksetzen → Alles zurücksetzen** stoppt und entfernt alle
Dienste und ihre Einstellungen und versetzt Ensembler in einen sauberen Zustand.
**Deine Mediendateien sind nicht betroffen** — nur Dienste und ihre
Konfiguration werden entfernt. Danach durchläufst du den
Einrichtungsassistenten erneut.

## Immer noch festgefahren?
Hol dir die Details aus den **Logs anzeigen** eines Dienstes und aus
**Einstellungen → Erweitert → Diagnose** — das sind die nützlichsten
Dinge, die du beim Melden eines Problems angeben kannst.
