# Primeros pasos

## Qué necesitas

Ensembler ejecuta tus servicios en Docker, así que necesitas un **entorno de
ejecución de contenedores** instalado y en funcionamiento — algo que
proporcione los comandos `docker` y `docker compose`.

- **Recomendado (lo más fácil):**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) — una
  instalación con un solo clic para macOS, Windows y Linux. Si no lo tienes,
  Ensembler te dirige a él en el primer inicio.
- **¿Ya usas otra cosa?** Cualquier entorno de ejecución compatible con Docker
  funciona igual de bien — por ejemplo **OrbStack** (macOS), **Podman**,
  **Rancher Desktop**, **colima** o **Docker Engine** en Linux. Mientras
  `docker` y `docker compose` funcionen, Ensembler los usará.

**No** necesitas Node.js, una terminal ni ninguna herramienta de desarrollo para
usar la aplicación.

## Primer inicio

Cuando abres Ensembler por primera vez, comprueba que Docker esté en
funcionamiento. Si Docker no está instalado o iniciado, verás instrucciones para
solucionarlo — inicia Docker Desktop, espera a que indique que está en
funcionamiento y Ensembler continuará.

## El asistente de configuración

### 1. Elige tus servicios
Los servicios recomendados vienen preseleccionados para un centro multimedia
completo. Algunas categorías —cliente de descargas, gestor de indexadores y
solicitudes— te permiten escoger una sola opción; otras —servidores multimedia y
gestión de medios— te permiten escoger varias (por ejemplo, ejecutar Plex y
Jellyfin a la vez).

### 2. Configura tus carpetas
Indica a Ensembler dónde viven tus **series de TV**, **películas** y
**descargas**. Estas son tus propias carpetas — elige ubicaciones con espacio
suficiente para tu biblioteca. Los puertos se comprueban automáticamente, y si un
puerto por defecto ya está en uso, Ensembler elige discretamente uno libre por
ti.

### 3. Aplica
Ensembler genera la configuración, inicia tus servicios y los conecta entre sí.
Verás completarse cada paso.

## Terminando la configuración

Algunos pasos solo puedes hacerlos tú, y el panel te los solicitará en una lista
**"Terminar de configurar"**:

- **Añade un indexador en Prowlarr** — para que Sonarr y Radarr puedan buscar
  contenido. Tú eliges tus propias fuentes; Ensembler nunca las elige por ti.
- **Inicia sesión en Plex** — Ensembler crea entonces tus bibliotecas de TV y
  Películas automáticamente.
- **Termina Overseerr** — inicia sesión con Plex y descubre tus otros servicios.

Cada indicación tiene un enlace **Abrir** que te lleva directamente al lugar
correcto.

¿Jellyfin o Emby? No están en esta lista — Ensembler ejecuta el contenedor, pero
cada uno gestiona su propia puesta en marcha inicial. Ábrelo desde el panel y
completa su configuración en su propia interfaz web (crea tu cuenta de
administrador y añade tus bibliotecas).

Una vez hechos esos pasos, ya estás en marcha.
