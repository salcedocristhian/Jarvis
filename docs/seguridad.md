# Seguridad y aprobaciones

- **Llaves:** solo en `.env` del servidor (ignorado por Git). El navegador nunca las ve.
- **JobTread en solo lectura:** `guardReadOnly()` en `server.js` rechaza cualquier consulta cuya raíz empiece con create, update, delete, send, upsert, copy, import, approve o void, aunque Claude lo pida. Está cubierto por `npm test`.
- **Acceso:** si el servidor sale de tu computadora, define `APP_PASSCODE`. Todas las rutas `/api/*` excepto `/api/status` lo exigen.
- **Archivos estáticos:** el servidor solo entrega lo que está dentro de `public/` (probado contra path traversal).
- **Escrituras futuras** (enviar correo, crear órdenes de cambio, pagar, publicar): siempre como propuesta visible con vista previa, aprobación explícita en la UI, registro de auditoría y confirmación del API antes de decir “hecho”. Redactar no es enviar.
- **Datos privados:** los IDs y nombres reales van en `.env`, no en el código ni en los datos de demo.
