# Gestionar tus servicios

Todo ocurre en el **panel**. Cada servicio tiene una tarjeta que muestra su
estado y las acciones que puedes realizar.

## Tarjetas de servicio

- Un **punto de estado** de color te indica la situación de un vistazo:
  - **verde — En ejecución**
  - **gris — Detenido**
  - **ámbar — Configuración necesaria** o **Requiere atención**
- **Abrir** abre el servicio **dentro de Ensembler como una pestaña** — sin un
  navegador aparte y sin la advertencia "No es seguro". Una barra en la parte
  superior te permite cambiar entre el **Panel** y cualquier servicio abierto, y
  cerrar una pestaña con su **✕**. También tiene un botón de **recarga** y otro
  de **abrir en el navegador** para el servicio actual.
- Una pequeña **versión** aparece en cada tarjeta en ejecución. Un **🔒 candado**
  significa que el servicio está fijado a una versión concreta; el marcador **↻**
  significa que sigue la última versión. Se vuelve ámbar cuando hay una
  actualización disponible.
- El **menú ⋯** contiene el resto: **Abrir en el navegador**, **Iniciar /
  Detener**, **Reiniciar**, **Ver registros**, **Buscar actualizaciones** y
  **Configurar**.

Mientras un servicio se está iniciando o deteniendo, el estado muestra un breve
"Iniciando…/Deteniendo…" para que sepas que algo está pasando.

## Añadir y eliminar servicios

- **Añadir servicio** (arriba de la sección Servicios) te permite añadir
  cualquier cosa que no eligieras durante la configuración, agrupada por categoría
  para que sea fácil de encontrar.
- Para eliminar un servicio, abre su **menú ⋯ → Configurar**.

Tanto aquí como en el panel, los servicios se agrupan por categoría (servidores
multimedia, gestión de medios, clientes de descargas, etc.).

## Mantener los servicios actualizados

- Ensembler comprueba discretamente en segundo plano, de modo que las
  actualizaciones disponibles aparecen por sí solas. También puedes hacer clic en
  **Buscar actualizaciones** (arriba de la sección Servicios) para comprobar todo
  ahora, o comprobar un solo servicio mediante su **menú ⋯ → Buscar
  actualizaciones** (el resultado se muestra en la tarjeta).
- Cuando hay actualizaciones disponibles, el encabezado de Servicios muestra
  cuántas, y un botón **Actualizar todo** las aplica de una vez. Para actualizar
  solo uno, haz clic en **Actualización disponible — actualizar ahora** en su
  tarjeta. Tus ajustes se conservan.
- **Fija una versión.** Por defecto, cada servicio sigue la última versión. Para
  mantener uno en una versión concreta, abre **menú ⋯ → Configurar** y elige del
  desplegable **Versión**. Los servicios fijados muestran un 🔒 y dejan de
  ofrecer actualizaciones.
- **Actualizaciones automáticas.** Activa **Ajustes → General → Instalar
  actualizaciones automáticamente** para que Ensembler aplique las
  actualizaciones disponibles en segundo plano. Está desactivado por defecto,
  para que mantengas el control.

## Ajustes

Abre **Ajustes** (arriba a la derecha) para las opciones de toda la aplicación:

- **Apariencia** — tema (Claro, Oscuro o Sistema) e idioma.
- **General** — mantén Ensembler en la barra de menú / bandeja del sistema cuando
  cierres la ventana (activado por defecto; tus servicios siguen funcionando en
  cualquier caso — usa **Salir** en el menú de la bandeja para cerrar por
  completo), instala las actualizaciones de los servicios automáticamente
  (desactivado por defecto) y tu zona horaria.
- **Avanzado** — detalles técnicos que normalmente no necesitarás: diagnósticos
  (si Docker está en funcionamiento, cuántos servicios están activos), espacio
  libre en disco y memoria, y los identificadores de usuario/grupo usados para los
  permisos de archivos.
- **Restablecer → Restablecer todo** — detiene y elimina todos los servicios y sus
  ajustes, devolviendo Ensembler a una instalación nueva. **Tus archivos
  multimedia nunca se tocan** — solo se eliminan los servicios y su
  configuración.

## Dónde viven tus ajustes

Ensembler almacena su configuración en una carpeta oculta por usuario (gestionada
por ti — no deberías necesitar editarla):

- **macOS:** `~/Library/Application Support/Ensembler`
- **Windows:** `%APPDATA%\Ensembler`
- **Linux:** `~/.config/Ensembler`

Tus **archivos multimedia** (TV, películas, descargas) viven allí donde elegiste
durante la configuración y son independientes de esto.

## Diagnósticos

El estado técnico —si Docker está en funcionamiento, cuántos servicios están
activos y cuánto espacio libre hay en disco y memoria— se encuentra en **Ajustes
→ Avanzado**. Normalmente no lo necesitarás, pero resulta útil para solucionar
problemas.
