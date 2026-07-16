# Kom aan die gang

## Wat jy nodig het

Ensembler laat jou dienste in Docker loop, so jy benodig ’n **houer-looptyd**
wat geïnstalleer is en loop — iets wat die `docker`- en
`docker compose`-opdragte verskaf.

- **Aanbeveel (maklikste):**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) — ’n
  een-klik-installasie vir macOS, Windows, en Linux. As jy dit nie het nie, wys
  Ensembler jou daarheen met die eerste begin.
- **Gebruik jy reeds iets anders?** Enige Docker-versoenbare looptyd werk net
  so goed — byvoorbeeld **OrbStack** (macOS), **Podman**, **Rancher Desktop**,
  **colima**, of **Docker Engine** op Linux. Solank `docker` en
  `docker compose` werk, sal Ensembler hulle gebruik.

Jy het **nie** Node.js, ’n terminaal, of enige ontwikkelaargereedskap nodig om
die toepassing te gebruik nie.

## Eerste begin

Wanneer jy Ensembler vir die eerste keer oopmaak, kontroleer dit dat Docker
loop. As Docker nie geïnstalleer of begin is nie, sal jy instruksies sien om dit
reg te stel — begin Docker Desktop, wag dat dit sê dit loop, en Ensembler sal
voortgaan.

## Die opstellingassistent

### 1. Kies jou dienste
Aanbevole dienste is vooraf gekies vir ’n volledige mediasentrum. Sommige
kategorieë — aflaaikliënt, indekseerderbestuurder, en versoeke — laat jou ’n
enkele opsie kies; ander — **mediabedieners** en **mediabestuur** — laat jou
verskeie kies (byvoorbeeld, laat beide Plex en Jellyfin loop).

### 2. Stel jou vouers
Vertel Ensembler waar jou **TV-programme**, **flieks**, en **aflaaie** woon.
Hierdie is jou eie vouers — kies liggings met genoeg spasie vir jou biblioteek.
Poorte word outomaties gekontroleer, en as ’n verstekpoort reeds in gebruik is,
kies Ensembler stilweg ’n vrye een vir jou.

### 3. Pas toe
Ensembler genereer die konfigurasie, begin jou dienste, en verbind hulle aan
mekaar. Jy sal elke stap sien voltooi.

## Voltooiing van die opstelling

’n Paar stappe kan net deur jou gedoen word, en die kontroleskerm sal jou
daarvoor vra in ’n **"Voltooi die opstelling"**-lys:

- **Voeg ’n indekseerder in Prowlarr by** — sodat Sonarr en Radarr vir inhoud
  kan soek. Jy kies jou eie bronne; Ensembler kies dit nooit vir jou nie.
- **Meld by Plex aan** — Ensembler skep dan outomaties jou TV- en
  Flieks-biblioteke.
- **Voltooi Overseerr** — dit meld met Plex aan en ontdek jou ander dienste.

Elke aansporing het ’n **Maak oop**-skakel wat jou reguit na die regte plek
neem.

**Jellyfin of Emby?** Hierdie is nie in die lys nie — Ensembler laat die houer
loop, maar elkeen bestuur sy eie eerste begin. Maak dit vanaf die kontroleskerm
oop en voltooi sy opstelling in sy eie webkoppelvlak (skep jou
administrateur-rekening en voeg jou biblioteke by).

Sodra daardie gedoen is, is jy aan die gang.
