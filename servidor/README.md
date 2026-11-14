# Una — versión con servidor

Asistente personal por voz. Un orbe al centro, dos íconos mínimos y respuestas que llegan como cuadros animados: titular, cifra en latón, evidencia y la acción que toca. Lee tus proyectos de JobTread y habla con voz de ElevenLabs o con la del navegador.

## Arrancar en 2 minutos

```bash
cp .env.example .env      # llena las llaves que tengas
npm start                 # http://localhost:5173
```

No hay dependencias que instalar: solo Node 18 o superior. Sin llaves, la app abre en **modo DEMO**, con datos de ejemplo marcados como tal. También puedes forzarlo con `http://localhost:5173/?demo`.

## Qué hace hoy

| Pieza | Estado |
|---|---|
| Conversación por voz (tocar → hablar → responde hablando → vuelve a escuchar) | Funciona en Chrome, Edge, Android y Safari de iPhone |
| Respuestas como cuadros animados (titular, cifra rodando, evidencia, acción) | Funciona |
| Proyectos como satélites del orbe; dorado = algo pendiente | Funciona con `PINNED_JOBS` |
| Claude con consultas a JobTread | Funciona con `ANTHROPIC_API_KEY` y `JOBTREAD_GRANT_KEY`. **Solo lectura**: el servidor bloquea cualquier create/update/delete |
| Voz de ElevenLabs | Funciona con `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID`; si no, usa la voz del navegador |
| Outlook / Microsoft 365 | **Sin conectar.** Requiere registrar una app en Azure (OAuth). Ver `CLAUDE.md` |

## Gestos

- **Tocar el orbe:** empieza o termina la conversación. Si está hablando, la interrumpe.
- **Tocar un satélite:** pregunta por ese proyecto.
- **Mantener presionado el orbe:** abre el teclado.
- **Deslizar hacia abajo:** las respuestas vuelven al orbe y la pantalla queda limpia.
- **Deslizar hacia arriba:** menú con proyectos, historial del día y estado de conexiones.
- En computadora: barra espaciadora para hablar, flechas para pasar cuadros, Esc para cerrar.

Para terminar hablando, di “gracias, eso es todo”.

## Usarla en el iPhone

El micrófono del navegador exige HTTPS. Opciones:

1. **En tu red:** `npx localtunnel --port 5173` o Cloudflare Tunnel, y abre la URL https en Safari.
2. **Desplegada:** cualquier servicio que corra Node (Render, Railway, Fly.io). Pon las variables de `.env` en el panel del servicio y **define `APP_PASSCODE`** para que nadie más la use.

En Safari: Compartir → Agregar a pantalla de inicio. Abre a pantalla completa, como una app.

## Cambiar nombre o voz

- Nombre, dueño, idioma y pausa de silencio: `public/config.js`.
- Colores y tipografía: variables al inicio de `public/styles.css`.
- Voz de ElevenLabs: `ELEVENLABS_VOICE_ID` en `.env`.

## Pruebas

```bash
npm run check   # sintaxis
npm test        # servidor con Claude y JobTread simulados: estado, proyectos, bucle de herramientas,
                # bloqueo de escrituras, archivos estáticos y path traversal
```

## Estructura

```
server.js            servidor sin dependencias: API, llaves, Claude, JobTread, ElevenLabs
public/index.html    la pantalla
public/app.js        orbe, voz, cuadros animados, gestos
public/styles.css    sistema visual
public/config.js     marca editable
test/                pruebas de humo con APIs simuladas
docs/                arquitectura y seguridad
CLAUDE.md            instrucciones para seguir construyendo con Claude Code
```
