# Instrucciones para Claude Code

Este repo es **Una**. La app publicada es `index.html` en la raíz (GitHub Pages, llaves en el dispositivo). La carpeta `servidor/` es la versión con servidor Node para Render. Mantén ambas con el mismo diseño y el mismo contrato de respuesta.

Este proyecto, el asistente personal por voz de Chris. Es la primera pieza funcional del brief “Personal AI Operating System” (nombre provisional en ese brief: AETHER). Lee `docs/arquitectura.md` y `docs/seguridad.md` antes de cambiar algo.

## Reglas del proyecto

- La pantalla principal es el orbe. No agregues barras, tarjetas fijas ni chat visible por defecto. Todo resultado entra como cuadros (`frames`) y sale absorbido por el orbe.
- Las llaves nunca van en el repo. En `index.html` se guardan en el dispositivo; en `servidor/` viven en `.env` o en las variables del servicio.
- Integraciones de **solo lectura** por defecto. Escribir (enviar correo, crear en JobTread, publicar) requiere una propuesta visible y la aprobación explícita del usuario en la UI antes de ejecutar.
- No inventes datos. Si un conector no está, la UI lo dice (`not_connected`, `demo`). El modo DEMO siempre muestra la etiqueta DEMO.
- No toques otros repositorios sin rama, diff y aprobación.
- En `servidor/`, corre `npm run check && npm test` antes de dar algo por terminado.

## Contrato de respuesta (`POST /api/ask`)

```json
{
  "speech": "1 a 3 frases para decir en voz alta",
  "frames": [
    {"type":"headline","text":"..."},
    {"type":"number","value":4735.69,"format":"usd|count","label":"..."},
    {"type":"evidence","title":"...","detail":"...","source":"JobTread"},
    {"type":"action","text":"..."}
  ],
  "closer": "línea seca opcional",
  "project": "job id o null",
  "sources": ["JobTread"]
}
```
Para un nuevo tipo de cuadro: agrégalo a `systemPrompt()` y a `frameHTML()` en `index.html`, y lo mismo en `servidor/server.js` y `servidor/public/app.js`.

## Próximos pasos sugeridos (en orden)

1. **Outlook (Microsoft Graph):** registrar app en Azure AD, flujo OAuth de código con PKCE en el servidor, guardar el refresh token cifrado fuera del repo. Herramienta `email_search` de solo lectura con `/me/messages?$search=`. Nuevo tipo de cuadro `mail` que cae como papel.
2. **Aprobaciones:** tipo de cuadro `approval` con vista previa exacta de lo que se enviará o creará, botones Aprobar / Descartar, y registro en `data/audit.log` (quién, qué, cuándo, resultado del API).
3. **Reportes PDF reales:** `POST /api/report` que arme el reporte de un proyecto con datos de JobTread y devuelva un PDF descargable con fuentes y fecha.
4. **Barcelona Gardens y Ocean Park:** si existen sus repos o ZIP de reportes, impórtalos en solo lectura y muéstralos como evidencia. Si no hay acceso, la UI debe decir “Sin conectar”, nunca inventar documentos.
5. **Gráficas en el terreno:** que la malla de fondo se levante como montañas por proyecto cuando la respuesta compare cantidades.
6. CompanyCam, Google Drive, calendario y CAD quedan para después y siempre detrás de aprobaciones.

## IDs útiles

Los job IDs van en Ajustes → Proyectos fijos (o `PINNED_JOBS` en el servidor), no en el código. Formato: `id|Nombre corto,id|Nombre corto`.

## ÓNIX (fase 1: cuentas propias, bienvenida y conexiones)

- Cada persona conecta **sus propias** cuentas (Google o Microsoft) desde su celular. ÓNIX la llama por el nombre de su inicio de sesión. Nunca se asume que el usuario es Chris.
- Los tokens viven solo en memoria. En `localStorage` (prefijo `una.onix.`) solo van perfil, estado de cada conector, pedidos de conectores y segundos de voz usados.
- Un conector **bloqueado** nunca se pide a Google ni a Microsoft hasta que la persona lo desbloquee.
- Invitados no ven JobTread ni los proyectos de Chris; el agente no recibe la herramienta `jobtread_read`. Admin = SHA-256 del correo en `public/onix-config.js` (nunca el correo en claro).
- La bandera de admin y el límite de voz son del lado del cliente en fase 1: sirven para el uso normal, no contra alguien que edite su navegador. La protección real llega con el Worker de Cloudflare (fase 3).
- Sarcasmo para todos, pero nunca dentro de un correo o mensaje que se redacte para otra persona.
- La bienvenida usa la voz gratis del teléfono; la voz de ElevenLabs se reserva para conversaciones reales (admin sin límite, invitados `guestDailySeconds` al día).
- Archivos: `public/onix-config.js`, `onix-engine.js` (orbe y malla), `onix-accounts.js`, `onix-onboarding.js`, `onix-connectors.js`, `onix.css`. Prueba: `test/onix-accounts.mjs`. Configuración externa: `SETUP-ONIX.md`.
- `?classic` en la URL vuelve a la bienvenida vieja de Gmail.

## ÓNIX fases 2 y 3

- Pantalla principal: `public/onix-home.js` (orbe + malla; semana sobre la malla, tarjetas, número). El resumen al abrir usa la voz gratis del teléfono y solo datos reales.
- Lectura unificada Google/Microsoft: `public/onix-data.js`. Herramientas del agente: `public/onix-tools.js`.
- Escribir (responder correo, contestar invitación) requiere el conector "Send & reply" y SIEMPRE pasa por `OnixHome.confirm`: texto exacto en pantalla, editable, botón Send, 6 s para deshacer, registro en "What ÓNIX did for you". Las herramientas del agente nunca envían; el resultado vuelve como nota `ACTION_RESULT`.
- Servidor: `worker/onix-worker.js` (Cloudflare). Verifica identidad con el token de Google/Microsoft (no lo guarda), entrega el enlace privado de voz con presupuesto (día por invitado, mes para todos los invitados), IA gratis (Workers AI) con búsqueda Brave; Gemini solo de respaldo y sin datos personales. Llaves solo como secretos de Cloudflare.
- Pruebas: `test/onix-data.mjs`, `test/onix-worker.mjs`.
