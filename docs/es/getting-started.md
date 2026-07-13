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
completo. Las categorías marcadas como **"elige uno"** (servidor multimedia,
cliente de descargas, gestor de indexadores, solicitudes) te permiten escoger
una sola opción; "gestión de medios" te permite escoger varias.

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
  Películas automáticamente. (Jellyfin no necesita inicio de sesión — se
  configura por completo por ti.)
- **Termina Overseerr** — inicia sesión con Plex y descubre tus otros servicios.

Cada indicación tiene un enlace **Abrir** que te lleva directamente al lugar
correcto.

Una vez hechos esos pasos, ya estás en marcha.
