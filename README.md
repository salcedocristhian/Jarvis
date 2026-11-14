# Una

Asistente personal por voz. Un orbe al centro, dos íconos mínimos y respuestas que llegan como cuadros animados: titular, cifra en latón, evidencia y la acción que toca. Lee tus proyectos de JobTread y te habla.

**App:** https://salcedocristhian.github.io/Jarvis/

## Cómo funciona

Toda la app es un solo archivo, `index.html`, publicado con GitHub Pages. No tiene servidor ni llaves dentro: las llaves se pegan en **Ajustes** desde cada dispositivo y se guardan solo ahí.

| Pieza | Qué necesita |
|---|---|
| Orbe, animaciones, modo DEMO | Nada |
| Respuestas reales | Llave de Claude (console.anthropic.com, con saldo; Claude Pro no la incluye) |
| Tus proyectos | Grant key de JobTread + proyectos fijos (`id|Nombre,id|Nombre`) |
| Voz de ElevenLabs | Llave y Voice ID de ElevenLabs (opcional; si no, usa la voz del dispositivo) |
| Escucharte | Safari en iPhone, Chrome o Edge |

Después de pegar las llaves, toca **Probar conexiones**: dice qué funciona en ese dispositivo.

## En el iPhone

Abre la app en Safari → Compartir → **Agregar a pantalla de inicio**. Abre a pantalla completa, como una app.

## Gestos

- **Tocar el orbe:** empieza o termina la conversación. Si está hablando, la interrumpe.
- **Tocar un satélite:** pregunta por ese proyecto. Dorado = tiene documentos pendientes.
- **Mantener presionado el orbe:** escribir.
- **Deslizar hacia abajo:** las respuestas vuelven al orbe.
- **Deslizar hacia arriba:** proyectos, historial y conexiones.
- Para terminar hablando: “gracias, eso es todo”.

## Seguridad

- Nunca subas llaves al repositorio. Viven en el almacenamiento local de cada dispositivo; el botón **Borrar llaves** las elimina.
- Una **solo lee** de JobTread: cualquier consulta que intente crear, editar o borrar se bloquea antes de enviarse.
- La página es pública, pero sin tus llaves solo muestra el modo DEMO.

## Carpeta `servidor/`

Versión con servidor Node (sin dependencias) para cuando haga falta: si JobTread bloquea consultas desde el navegador, o para guardar las llaves fuera del teléfono. Se despliega en Render u otro servicio con Node. Instrucciones en `servidor/README.md`.

## Seguir construyendo

Ver `CLAUDE.md` (instrucciones para Claude Code) y `docs/`.
