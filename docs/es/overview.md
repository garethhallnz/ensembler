# ¿Qué es Ensembler?

Ensembler configura y ejecuta un **centro multimedia doméstico** por ti — el
popular stack "*arr" (Sonarr, Radarr, Prowlarr y compañía) junto con un servidor
multimedia como Plex o Jellyfin — sin que necesites saber nada de Docker, YAML o
la línea de comandos.

Eliges los servicios que quieres, Ensembler los instala, los inicia, los conecta
entre sí y te da un único panel para gestionarlo todo.

## Cómo funciona

Por debajo, cada servicio se ejecuta en su propio **contenedor de Docker**.
Ensembler genera la configuración de Docker, inicia los contenedores y los
conecta entre sí para que funcionen como un solo sistema. Nunca tienes que tocar
un archivo de configuración.

El recorrido habitual es:

1. **Asistente de configuración** — elige tus servicios, indica a Ensembler dónde
   están tus carpetas de medios y haz clic en **Aplicar**. Los puertos se
   comprueban por ti, y se eligen automáticamente unos libres si alguno por
   defecto está ocupado.
2. **Conexión automática** — Sonarr y Radarr obtienen su cliente de descargas y
   sus carpetas, Prowlarr se enlaza con ellos, Plex recibe notificaciones de
   importación una vez que inicies sesión, y así sucesivamente. Ves completarse
   cada paso.
3. **Panel** — a partir de ahí gestionas todo desde un solo lugar: abre un
   servicio, inícialo/deténlo, busca actualizaciones o añade más servicios.

## Qué hacen los servicios

| Servicio | Función |
|---|---|
| **Sonarr** | Gestiona tus series de TV |
| **Radarr** | Gestiona tus películas |
| **Bazarr** | Gestiona los subtítulos de Sonarr/Radarr |
| **Plex / Jellyfin / Emby** | Transmiten tus medios a tus dispositivos |
| **Transmission / Deluge** | Clientes de descargas |
| **Prowlarr / Jackett** | Gestionan dónde buscan contenido tus servicios |
| **Overseerr** | Solicita y descubre medios |

## Qué hace Ensembler — y qué no hace

Ensembler **conecta tus servicios entre sí**. **No** selecciona, solicita ni
descarga ningún contenido, y **no** configura indexadores ni rastreadores por
ti. Tú eliges tus propias fuentes y eres responsable de cómo las usas.
