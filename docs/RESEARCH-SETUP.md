# Jarvis — investigación pública con Gemini y Google Search

## Estado de implementación

El repositorio incluye un **backend independiente** en `cloudflare/jarvis-research.mjs`, un cliente en `public/web-research.js` y una herramienta de voz `web_research`. En GitHub Pages el backend NO se despliega automáticamente. No declares la búsqueda activa hasta que `/health` indique `ready: true` y una pregunta autorizada devuelva fuentes verificables.

No reutilizar secretos de Gorilla Screens copiándolos al repositorio. El worker existente de Gorilla Screens restringe origen y función a imágenes; no es un proveedor público de investigación para Jarvis.

## Despliegue autorizado en Cloudflare

Necesitas acceso a la cuenta Cloudflare donde se encuentra Gorilla Screens y una **Gemini API key** en Google AI Studio. Las claves existentes en Cloudflare **no se pueden leer ni copiar**; vuelve a registrarla como secreto del Worker de Jarvis. Jamás pegar keys en GitHub o en el chat.

1. En Cloudflare, crear `jarvis-research` como Worker desde `cloudflare/wrangler.research.json` y `cloudflare/jarvis-research.mjs` (o con `npx wrangler deploy --config cloudflare/wrangler.research.json`). Alternativamente, autorizar el workflow manual `research-worker-deploy.yml` con la variable GitHub `JARVIS_RESEARCH_DEPLOY=true` y los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` del repositorio Jarvis. Confirmar la URL real.
2. Asignar los secretos `GEMINI_API_KEY` y `JARVIS_PILOT_TOKEN` **en el Worker**, no en GitHub Pages. El token de prueba debe ser aleatorio, diferente del de Gorilla, de 32 o más caracteres. Ejemplo en terminal: `openssl rand -hex 32` (no registrar el resultado en un archivo versionado).
3. Confirmar el binding `AI_RATE_LIMIT` del archivo de Wrangler. Es 5 solicitudes/minuto por ubicación de Cloudflare, NO un límite global de gasto.
4. Verificar `https://jarvis-research.salcedo-cristhian-2020.workers.dev/health`: `ready: true`. Si la cuenta asigna otro subdominio, cambiar la constante `ENDPOINT` del cliente antes de desplegar GitHub Pages.
5. Abrir Jarvis → Ajustes → **Internet con Gemini** e introducir solamente el `JARVIS_PILOT_TOKEN` (no la Gemini API key). El token permanece en la memoria de esa pestaña y se borra al recargar.
6. Pedir por voz «Busca las últimas noticias de tecnología y muéstrame las fuentes»; verificar respuesta oral y enlaces HTTPS. Solicitudes no autorizadas, fuera de origen y sin fuentes deben fallar con mensajes honestos.

La app usa `gemini-2.5-flash-lite` y `google_search` oficialmente documentado. La API puede tener cuota gratuita limitada; **no se garantiza costo cero si está habilitada la facturación**. Revisar límites y presupuestos de Google antes de activar producción. No usar el servicio para datos privados de proyectos, emails, claves ni facturas; el frontend únicamente envía la pregunta de búsqueda pública.

## Seguridad y operación

- Origin exacto: `https://salcedocristhian.github.io` (el origen no es autenticación).
- Control por Bearer token privado con comparación hash constante; ninguna contraseña, llave de Gemini o de JobTread se expone en el JavaScript público.
- Solo preguntas de 2–600 caracteres, límite de cuerpo, HTTPS, sin historial ni almacenamiento de prompts en código.
- Solo se muestran fuentes HTTPS devueltas realmente por Gemini. Si no hay citas, se informa que la respuesta **no está verificada**.
- La cuota de Cloudflare es aproximada por ubicación. Para uso masivo añadir cuentas de usuarios, una cuota diaria global atómica y controles de gastos antes de ofrecer el servicio a terceros.
- Pruebas locales: `npm test` incluye `test/research.mjs` con simulaciones, sin usar claves reales ni generar cargos.

## Por qué no se activó Groq todavía

Jarvis ya usa Gemini 2.5 Flash-Lite en ElevenLabs. Groq como segundo modelo no aporta información actualizada por sí solo: necesitaría otra clave, cuotas y otro enrutador. Mantener un backend de búsqueda pequeño reduce costo, complejidad y riesgo. Se puede agregar luego como respaldo explícito si el uso lo justifica.
