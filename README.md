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

## Demo con proyectos reales (rama de revisión)

En modo DEMO, la app muestra tarjetas animadas con datos de los repositorios públicos `5660-collins-app`, `Barcelona`, `Gorilla-Screens` y `19984-Kingfisher-Lane-App`; Ocean Park Manor se identifica como **sin conectar** hasta disponer de una fuente verificable.

- Pregunta por «5660 Collins», «Barcelona», «Gorilla» o «Kingfisher»; también por «conexiones» o «qué puedes hacer».
- Los datos de permisos se consultan en `data/permits.json` de 5660; los demás casos consultan el README original y muestran enlaces directos a la fuente.
- Si GitHub no responde, el demo mantiene un resumen de referencia claramente identificado: **no** es una sincronización en tiempo real, ni confirma finalización de una obra o validación oficial de un permiso.
- Los resultados aparecen como cuadros cinematográficos, con enlaces a la evidencia y controles táctiles para avanzar entre cuadros.
- DEMO puede usar ElevenLabs si hay credenciales configuradas: se eliminó el bloqueo que forzaba la voz del navegador cuando el demo estaba activado.

### La voz del artifact Voice Lab

El artifact anterior contenía **grabaciones generadas con ElevenLabs**. El repositorio no incluye esos MP3 ni el ID exacto de aquella voz. Para que Una pronuncie respuestas nuevas con esa voz, configura el **mismo Voice ID** y tu propia API key de ElevenLabs. En la versión publicada en GitHub Pages, ambos se introducen desde Ajustes en el dispositivo; en la versión con servidor, como `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID` fuera de GitHub. La voz del iPhone es solo respaldo y no reproduce exactamente aquel timbre.

**Seguridad:** para uso corporativo/compartido, se recomienda la versión con servidor: no incrustes API keys en el código ni entregues una key de producción a usuarios de un navegador público. Para publicar cambios, revisa el diff y prueba Safari/iPhone antes de fusionar a `main`.
