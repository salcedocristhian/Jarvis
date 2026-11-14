# Arquitectura

```
iPhone / navegador                         servidor local (Node, sin dependencias)
──────────────────                         ───────────────────────────────────────
Web Speech API  ──texto──►  POST /api/ask ─►  Claude (Messages API, bucle de herramientas)
                                               └─► jobtread_query ─► api.jobtread.com/pave (solo lectura)
cuadros animados ◄──JSON──  speech + frames
voz  ◄──audio/mpeg──────── POST /api/tts  ─►  ElevenLabs (opcional)
                           GET  /api/projects ─► JobTread (resumen de PINNED_JOBS)
                           GET  /api/status   ─► qué está conectado
```

- **Por qué sin framework:** una sola pantalla con canvas y animaciones CSS. Sin build ni dependencias, se despliega en cualquier lado y no se rompe con actualizaciones de paquetes. Si crece a varias pantallas complejas, migrar a Vite + TypeScript es directo porque la lógica ya está separada (voz, reel, gestos, API).
- **Por qué un servidor:** las llaves de Claude, JobTread y ElevenLabs no pueden vivir en el navegador. El servidor también es el único lugar donde se bloquean escrituras.
- **Voz de entrada:** Web Speech API del navegador, una frase por turno. Después de cada respuesta vuelve a escuchar; si el navegador exige otro toque, la UI muestra “Toca para responder”.
- **Voz de salida:** ElevenLabs si está configurado; si no, `speechSynthesis` del navegador.
- **Estado:** el historial de la conversación vive en memoria de la pestaña. Las preferencias se guardan en `localStorage` del dispositivo.
