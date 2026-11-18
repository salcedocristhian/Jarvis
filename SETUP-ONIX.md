# ÓNIX · Puesta en marcha (gratis, hasta 100 personas)

Todo esto se hace una sola vez. Nada de aquí es secreto: los Client ID son públicos. **Nunca** pegues una contraseña, token o API key en el repo.

## 1. Subir a GitHub Pages
1. Reemplaza el contenido del repo `salcedocristhian/Jarvis` con esta carpeta (en una rama, revisa el diff y luego merge a `main`).
2. Abre `https://salcedocristhian.github.io/Jarvis/` en el iPhone → Compartir → **Agregar a pantalla de inicio**. Aparece como ÓNIX con su ícono.

## 2. Google (Gmail, Calendar y Drive) · gratis
En [Google Cloud Console](https://console.cloud.google.com/), en el mismo proyecto del Client ID que ya usas:
1. **APIs y servicios → Biblioteca:** habilita *Gmail API* (ya está), *Google Calendar API* y *Google Drive API*.
2. **Google Auth Platform → Acceso a datos (Scopes):** agrega `gmail.readonly`, `calendar.readonly` y `drive.metadata.readonly`.
3. **Público (Audience):** deja la app en **Testing** y agrega como *usuarios de prueba* el Gmail de cada persona (máximo 100). Así no necesitas la verificación de Google ni la auditoría de seguridad (que cuesta).
4. **Clientes → tu cliente web → Orígenes de JavaScript autorizados:** `https://salcedocristhian.github.io`.

Notas del modo Testing: Google muestra una pantalla de "app no verificada" (la persona toca *Continuar*). El permiso dura la sesión; al volver a abrir ÓNIX, un toque en *Reconnect* lo renueva.

## 3. Microsoft (Outlook, Calendar, OneDrive) · gratis, opcional
Solo si alguien usa Outlook. En [Microsoft Entra → Registros de aplicaciones](https://entra.microsoft.com/):
1. **Nuevo registro** → nombre "ÓNIX" → *Cuentas de cualquier directorio organizativo y cuentas personales de Microsoft*.
2. **URI de redirección:** plataforma **Aplicación de página única (SPA)** → `https://salcedocristhian.github.io/Jarvis/`.
3. **Permisos de API → Microsoft Graph → Delegados:** `User.Read`, `Mail.Read`, `Calendars.Read`, `Files.Read`, `offline_access`.
4. Copia el **Application (client) ID** en `public/onix-config.js` → `microsoft.clientId`.

Sin este paso, la opción Outlook dice que todavía no está lista y ofrece Gmail.

## 4. ElevenLabs (tu plan Creator de $22)
El plan trae ~275 minutos al mes. ÓNIX los cuida así:
- **Una sola voz en todo momento:** la bienvenida, el resumen al abrir y las respuestas escritas usan la misma voz de tu agente de ElevenLabs, generada por el servidor de Cloudflare (paso 6). Cada frase se genera una vez y queda guardada: las frases fijas de la bienvenida cuestan créditos solo la primera vez. Sin el servidor, ÓNIX usa la voz del teléfono para no quedarse callado.
- Límites de esa voz: 2500 caracteres nuevos al día por invitado y 4000 al día para la pantalla de bienvenida (antes de iniciar sesión). Tú sin límite.
- Tú (admin, por el hash de tu correo) usas la voz premium sin límite.
- Cada invitado tiene 1 minuto al día. Con el servidor de Cloudflare (paso 6), además todos los invitados juntos tienen un tope de 100 min al mes, y se cuenta en el servidor, no en el teléfono.
- Cuando se acaba, escriben (mantener presionado el orbe) y responde la IA gratis.

### 4a. Prompt
En tu agente (*agent_9601m7…*) → **Agent** → **System prompt**, agrega al final:

```
You are ÓNIX, a sarcastic but useful personal assistant. You speak English.
The person talking is {{user_name}} ({{user_role}}). Never call them Chris unless their name is Chris.
Today is {{today}}. Their time zone is {{time_zone}}. Use YYYY-MM-DD dates when calling tools.
Sarcasm is for the conversation only. Never put sarcasm inside an email or message written for someone else.
If user_role is guest: you cannot see JobTread or Chris's projects.
They asked Chris for these connectors: {{connector_requests}}. If it is not "none", confirm you passed it on.
If they ask to be called something else, call set_nickname with the new name, then use it.

Projects this person can ask about: {{projects}}. Use project_read for them (permits, dates, DERM plan, NV5 marks). If it says "none", they have no project access.
Tools: mail_search and mail_read for email, calendar_read for meetings, drive_search for files, web_search for anything current on the internet.
Never say an email was sent or an invite answered until you get an ACTION_RESULT note. reply_email and answer_invite only put it on screen; the person approves.
Keep spoken answers short. The screen shows the details.

FIRST CONVERSATION: if {{first_conversation}} is "yes", before anything else run a short recon, like a Navy SEAL briefing, sarcastic but respectful, one question at a time, 6 questions max:
1. What they do and for which company.
2. The projects or clients that matter most right now.
3. Whose emails can never wait.
4. What a normal day looks like and what eats their time.
5. Which apps they live in (Procore, WhatsApp, Excel, QuickBooks…).
6. The one thing they wish an assistant did for them.
Close with a 2-line summary and "Recon complete. Chris will see this."
```

**First message:** `Hey {{user_name}}. What do you need?`

**Dynamic variables** (con valor de prueba): `user_name`=Chris, `user_email`=test@example.com, `user_role`=admin, `connector_requests`=none, `voice_seconds_left`=-1, `first_conversation`=no, `today`=Tuesday, November 17, 2026, `time_zone`=America/New_York, `projects`=5660 Collins.

### 4b. Herramientas (Tools → Add tool → **Client tool**, todas con *Wait for response*)
| Name | Description | Parámetros |
|---|---|---|
| `mail_search` | Find emails in the user's inbox. | `query` (string, opcional): words, or "unread", "important", "today", "from:name" · `limit` (number, opcional) |
| `mail_read` | Read one email in full. | `email_id` (string, requerido) |
| `calendar_read` | List the user's meetings for a day or range. | `start_date` (string, requerido, YYYY-MM-DD) · `end_date` (string, opcional) |
| `drive_search` | Find files by name in Drive or OneDrive. | `query` (string, opcional) |
| `reply_email` | Put a reply on screen for the user to approve. Never sends by itself. | `email_id` (string, requerido) · `text` (string, requerido) |
| `answer_invite` | Put an RSVP on screen for the user to approve. | `event_id` (string, requerido) · `response` (string, requerido: accept, decline o tentative) · `note` (string, opcional) |
| `web_search` | Search the web for current information. | `query` (string, requerido) |
| `set_nickname` | Save what the user wants to be called. | `nickname` (string, requerido) |
| `project_read` | Read one of Chris's project repos: permits, key dates, DERM plan, repair marks. | `project` (string, requerido) · `topic` (string, opcional: e.g. "permits", "DERM plan") |

Deja `jobtread_read` y `gmail_read` como están (siguen funcionando).

### 4c. El reconocimiento (recon)
En **Analysis → Data collection** agrega estos campos (tipo string), para verlos resumidos en cada conversación: `role_and_company`, `key_projects`, `vip_senders`, `daily_routine`, `apps_used`, `wish`, `connector_requests`.
La primera conversación de cada persona (≥45 s) cuenta como recon; después `first_conversation` pasa a "no".
Para leerlo: **ElevenLabs → Agents → ÓNIX → Conversation history**. Cada conversación muestra las variables (nombre, correo, rol) y los campos de arriba.

### 4d. Seguridad del agente (solo después del paso 6)
- **Security → Enable authentication**: así nadie puede usar tu agente sin el permiso del servidor de ÓNIX. **No lo actives antes** de tener el servidor funcionando o la voz dejará de conectar.
- **Advanced → Max conversation duration**: 300 segundos.

## 5. Agregar un admin o dar acceso a un proyecto
En una terminal: `printf '%s' 'correo@empresa.com' | shasum -a 256` y pega el resultado en `adminEmailHashes`.

**Dar acceso a un proyecto** (por ejemplo, Tiana solo al 5660): saca el hash de su correo con el mismo comando y pégalo en `public/onix-config.js` → `projects` → el proyecto → `people`. Tú, como admin, ves todos. ÓNIX lee los repos públicos directo de GitHub, solo los archivos de la lista en `public/onix-projects.js`, y nunca escribe en ellos.

## 6. Servidor gratis en Cloudflare (fase 3)
Esto cuida tus minutos de verdad y activa la IA gratis y la búsqueda web. Todo cabe en el plan gratis.
1. Crea una cuenta en [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. **Workers & Pages → Create → Create Worker**, nombre `onix` → Deploy. Luego **Edit code**, borra lo que trae, pega todo `worker/onix-worker.js` y **Deploy**.
3. **Storage & Databases → KV → Create**: nombre `ONIX_KV`.
4. En el worker → **Settings → Bindings → Add**:
   - *KV namespace*: Variable name `ONIX_KV`, namespace `ONIX_KV`.
   - *Workers AI*: Variable name `AI`.
5. **Settings → Variables and secrets → Add → Secret**:
   - `ELEVENLABS_API_KEY`: en ElevenLabs → Developers → API Keys, crea una llave solo con permiso de ElevenAgents/Conversational AI.
   - `BRAVE_API_KEY` (opcional, búsqueda web): [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/). Pon el límite de gasto en $0.
   - `GEMINI_API_KEY` (opcional, respaldo de IA): [aistudio.google.com](https://aistudio.google.com/apikey). Nunca recibe correos ni calendario.
   El servidor usa la misma voz y modelo de tu agente automáticamente (para otra voz, agrega la variable `VOICE_ID`).
   Los límites (60 s al día por invitado, 6000 s al mes para invitados, 80 mensajes de texto al día) ya vienen en el código; para cambiarlos agrega *Variables* con los nombres de `wrangler.toml`.
6. Abre `https://onix.TU-SUBDOMINIO.workers.dev/health`. Debe decir `"ok":true,"kv":true,"ai":true,"voice":true`.
7. Pega esa dirección (sin `/health`) en `public/onix-config.js` → `worker.url`, súbelo a GitHub y prueba la voz.
8. Cuando la voz funcione con el servidor, activa la seguridad del agente (paso 4d).

Si prefieres terminal: `cd worker && npx wrangler kv namespace create ONIX_KV`, pega el id en `wrangler.toml`, `npx wrangler secret put ELEVENLABS_API_KEY` y `npx wrangler deploy`.

## Lo que cuesta
| Parte | Costo |
|---|---|
| GitHub Pages | $0 |
| Google APIs en modo Testing (≤100 personas) | $0 |
| Microsoft Graph | $0 |
| Voz de bienvenida (teléfono) | $0 |
| Voz premium ElevenLabs | Tus $22/mes (~275 min compartidos) |
| Cloudflare Workers + KV + Workers AI | $0 (100k pedidos/día, ~10k neuronas/día) |
| Brave Search / Gemini (opcionales) | $0 con límite en $0 |

Para pasar de 100 personas o salir a todo el mundo hace falta: dominio propio, política de privacidad, verificación de Google con auditoría CASA (~$540–720 al año) y la verificación de editor de Microsoft (gratis). Eso es la fase 4.
