# Cómo actualizar Ensembler

Esta página trata sobre cómo actualizar **el propio Ensembler** — la aplicación.
(Para mantener actualizados tus *servicios* como Sonarr y Plex, consulta
**Gestionar tus servicios → Mantener los servicios actualizados**.)

## Cómo sabrás que hay una actualización

Ensembler comprueba de vez en cuando si se ha publicado una versión más reciente
y muestra un pequeño aviso en el panel cuando hay una disponible. También puedes
comprobarlo en cualquier momento en **Ajustes → General → Buscar
actualizaciones**.

Ensembler nunca instala una nueva versión por sí solo — actualizar es un paso
manual rápido, y la idea es la misma en todas las plataformas: **descarga la
última versión y ábrela**. Tus servicios y ajustes se quedan completamente
intactos.

## Actualizar

1. Abre la **[página de versiones](https://github.com/garethhallnz/ensembler/releases)**
   (el aviso de actualización enlaza directamente allí).
2. Descarga el archivo para tu sistema y luego instálalo sobre tu copia actual:

   - **macOS** — descarga el `.dmg`, ábrelo y arrastra **Ensembler** a tu carpeta
     de **Aplicaciones**, reemplazando el anterior. La primera vez que abras la
     nueva versión, haz clic derecho (o Control-clic) sobre la aplicación y elige
     **Abrir**.
   - **Windows** — descarga el `.exe` y ejecútalo. Se instala sobre tu versión
     existente. Si Windows muestra una pantalla de "Windows protegió tu PC", haz
     clic en **Más información → Ejecutar de todas formas**.
   - **Linux** — descarga el nuevo `.AppImage` y reemplaza el anterior. Puede que
     tengas que marcarlo como ejecutable de nuevo (clic derecho → **Propiedades →
     Permisos**, o `chmod +x` en una terminal).

3. Abre Ensembler. Eso es todo — tus servicios siguen funcionando durante todo el
   proceso, y todos tus ajustes están exactamente como los dejaste.

## Desactivar el aviso

Si prefieres no ver los avisos de actualización, desactiva **Ajustes → General →
Notificaciones de actualización**. Aún puedes comprobarlo manualmente cuando
quieras con el botón **Buscar actualizaciones**.

> **Por qué la actualización es manual:** mantiene Ensembler sencillo y coherente
> en macOS, Windows y Linux, y hace que la aplicación nunca se cambie a sí misma
> a tus espaldas. Tus archivos multimedia nunca se ven afectados por una
> actualización.
