# Wat is Ensembler?

Ensembler stel ’n **tuis-mediasentrum** vir jou op en laat dit loop — die gewilde
"*arr"-stapel (Sonarr, Radarr, Prowlarr en vriende) plus ’n mediabediener soos
Plex of Jellyfin — sonder dat jy Docker, YAML, of die opdraglyn hoef te ken.

Jy kies die dienste wat jy wil hê, Ensembler installeer hulle, begin hulle, koppel
hulle aan mekaar, en gee jou ’n enkele kontroleskerm om alles te bestuur.

## Hoe dit werk

Onder die enjinkap loop elke diens in sy eie **Docker-houer**. Ensembler
genereer die Docker-konfigurasie, begin die houers, en verbind hulle aan
mekaar sodat hulle as een stelsel werk. Jy hoef nooit aan ’n konfigurasielêer
te raak nie.

Die tipiese reis is:

1. **Opstellingassistent** — kies jou dienste, wys Ensembler na jou
   mediavouers, en klik **Pas toe**. Poorte word vir jou gekontroleer, en vrye
   poorte word outomaties gekies as ’n verstek reeds geneem is.
2. **Outomatiese koppeling** — Sonarr en Radarr kry hul aflaaikliënt en
   vouers, Prowlarr koppel aan hulle, Plex kry invoerkennisgewings sodra jy
   aanmeld, ensovoorts. Jy kyk hoe elke stap voltooi.
3. **Kontroleskerm** — van daar af bestuur jy alles vanuit een plek: maak ’n
   diens oop, begin/stop dit, kontroleer vir opdaterings, of voeg meer dienste by.

## Wat die dienste doen

| Diens | Rol |
|---|---|
| **Sonarr** | Bestuur jou TV-programme |
| **Radarr** | Bestuur jou flieks |
| **Bazarr** | Bestuur onderskrifte vir Sonarr/Radarr |
| **Plex / Jellyfin / Emby** | Stroom jou media na jou toestelle |
| **Transmission / Deluge** | Aflaaikliënte |
| **Prowlarr / Jackett** | Bestuur waar jou dienste vir inhoud soek |
| **Overseerr** | Versoek en ontdek media |

## Wat Ensembler doen — en nie doen nie

Ensembler **verbind jou dienste aan mekaar**. Dit **kies, versoek, of laai
NIE** enige inhoud af nie, en dit **konfigureer NIE** indekseerders of
spoorsnyers vir jou nie. Jy kies jou eie bronne en is verantwoordelik vir hoe
jy hulle gebruik.
