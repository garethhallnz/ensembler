# So aktualisierst du Ensembler

Auf dieser Seite geht es darum, **Ensembler selbst** zu aktualisieren — die App.
(Wie du deine *Dienste* wie Sonarr und Plex aktuell hältst, erfährst du unter
**Dienste verwalten → Dienste aktuell halten**.)

## Woran du erkennst, dass es ein Update gibt

Ensembler prüft ab und zu, ob eine neuere Version veröffentlicht wurde, und zeigt
einen kleinen Hinweis auf dem Dashboard, wenn eine verfügbar ist. Du kannst
jederzeit auch unter **Einstellungen → Allgemein → Nach Updates suchen** prüfen.

Ensembler installiert niemals von selbst eine neue Version — das Aktualisieren ist
ein schneller manueller Schritt, und auf jeder Plattform ist die Idee dieselbe:
**die neueste Version herunterladen und öffnen**. Deine Dienste und Einstellungen
bleiben völlig unangetastet.

## Aktualisieren

1. Öffne die **[Releases-Seite](https://github.com/garethhallnz/ensembler/releases)**
   (der Update-Hinweis verlinkt direkt dorthin).
2. Lade die Datei für dein System herunter und installiere sie dann über deine
   aktuelle Kopie:

   - **macOS** — lade die `.dmg` herunter, öffne sie und ziehe **Ensembler** in
     deinen **Programme**-Ordner, wobei die alte Version ersetzt wird. Wenn du die
     neue Version zum ersten Mal öffnest, klicke mit der rechten Maustaste (oder
     Control-Klick) auf die App und wähle **Öffnen**.
   - **Windows** — lade die `.exe` herunter und führe sie aus. Sie installiert
     sich über deine bestehende Version. Wenn Windows den Bildschirm „Der
     Computer wurde durch Windows geschützt“ anzeigt, klicke auf **Weitere
     Informationen → Trotzdem ausführen**.
   - **Linux** — lade die neue `.AppImage` herunter und ersetze die alte. Du musst
     sie möglicherweise erneut als ausführbar markieren (Rechtsklick →
     **Eigenschaften → Berechtigungen** oder `chmod +x` in einem Terminal).

3. Öffne Ensembler. Das war's — deine Dienste laufen die ganze Zeit weiter, und
   alle deine Einstellungen sind genau so, wie du sie verlassen hast.

## Den Hinweis abschalten

Wenn du keine Update-Hinweise sehen möchtest, schalte **Einstellungen → Allgemein
→ Update-Benachrichtigungen** aus. Du kannst weiterhin jederzeit manuell mit der
Schaltfläche **Nach Updates suchen** prüfen.

> **Warum das Aktualisieren manuell erfolgt:** Es hält Ensembler einfach und
> einheitlich über macOS, Windows und Linux hinweg und bedeutet, dass sich die App
> nie hinter deinem Rücken selbst verändert. Deine Mediendateien sind von einem
> Update nie betroffen.
