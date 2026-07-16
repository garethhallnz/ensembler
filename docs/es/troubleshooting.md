# Solución de problemas

## "Se requiere Docker" / Docker no está en funcionamiento
Ensembler necesita un entorno de ejecución de contenedores en funcionamiento. Si
usas **Docker Desktop**, inícialo y espera hasta que indique que está en
funcionamiento (no solo instalado), y Ensembler continuará. Si no está
instalado, sigue el enlace de descarga de esa pantalla. ¿Usas una alternativa
como **OrbStack** o **Podman**? Eso también está bien — solo asegúrate de que
esté en funcionamiento y de que `docker` y `docker compose` funcionen.

## Un servicio no se inicia
- Abre el **menú ⋯ → Ver registros** del servicio para ver de qué se queja.
- Prueba **menú ⋯ → Reiniciar**.
- Las notificaciones de importación y los escaneos de la biblioteca pueden tardar
  un minuto mientras los servicios terminan de iniciarse, así que dale un momento
  después del primer inicio.

## Una advertencia sobre la memoria o el espacio en disco de Docker
Ensembler avisa cuando Docker tiene poca memoria asignada o el disco de medios
está casi lleno — las dos razones más comunes e invisibles por las que los
servicios se comportan mal.
- **Memoria:** auméntala en los ajustes de tu entorno de ejecución de
  contenedores (Docker Desktop → Settings → Resources); 4 GB o más es una buena
  base para unos cuantos servicios.
- **Disco:** libera espacio en la unidad que usan tus descargas/medios, o dirige
  los servicios a una unidad más grande desde su pantalla de **Configurar**.

## Advertencia "No es seguro" al abrir un servicio
Los servicios ahora se abren **dentro de Ensembler** como pestañas, así que no
deberías ver esto. Solo aparece si usas el **menú ⋯ → Abrir en el navegador** de
un servicio (o ejecutas Ensembler en un navegador web). Los servicios locales
funcionan sobre `http://localhost`, que los navegadores etiquetan como "No es
seguro" — para un servicio en tu propia máquina eso es lo esperado e inofensivo;
tus datos no salen de tu ordenador.

## Un puerto ya está en uso
Ensembler comprueba los puertos durante la configuración y elige automáticamente
uno libre si alguno por defecto está ocupado, así que esto es poco frecuente. Si
un servicio aún así no se vincula, puede que otra aplicación haya tomado su
puerto — detén esa aplicación, o cambia el puerto desde la pantalla de
**Configurar** del servicio.

## ¿Dónde están mis datos?
- **La configuración de la aplicación** vive en una carpeta oculta por usuario
  (consulta *Gestionar tus servicios → Dónde viven tus ajustes*). No necesitas
  editarla.
- **Tus medios** permanecen allí donde elegiste durante la configuración y
  Ensembler nunca los mueve ni los elimina.

## Algo está muy atascado — empieza de cero
**Ajustes → Restablecer → Restablecer todo** detiene y elimina todos los
servicios y sus ajustes y devuelve Ensembler a un estado limpio. **Tus archivos
multimedia no se ven afectados** — solo se eliminan los servicios y su
configuración. Después volverás a pasar por el asistente de configuración.

## ¿Sigues atascado?
Toma los detalles de **Ver registros** de un servicio y de **Ajustes → Avanzado
→ Diagnósticos** — esas son las cosas más útiles que incluir al informar de un
problema.
