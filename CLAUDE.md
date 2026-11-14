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
