# Una

Asistente personal por voz. Un orbe al centro, dos íconos mínimos y respuestas que llegan como cuadros animados: titular, cifra en latón, evidencia y la acción que toca. Lee tus proyectos de JobTread y te habla.

**App:** https://salcedocristhian.github.io/Jarvis/

## Cómo funciona

Toda la app es un solo archivo, `index.html`, publicado con GitHub Pages. No tiene servidor ni llaves dentro: las llaves se pegan en **Ajustes** desde cada dispositivo y se guardan solo ahí.

| Pieza | Qué necesita |
|---|---|
| Orbe, animaciones, modo DEMO | Nada |
| Consultas reales de JobTread sin IA | Grant Key de JobTread; no necesita Claude |
| Preguntas conversacionales abiertas y análisis con IA | Llave de Claude opcional (API con créditos, diferente de Claude Pro) |
| Proyectos y tareas de JobTread | Grant Key; los proyectos fijos (`id|Nombre,id|Nombre`) son opcionales |
| Voz de ElevenAgents (recomendada) | No requiere API Key en el navegador; usa agente separado para Jarvis y el Voice ID configurado en la cuenta ElevenLabs |\n| ElevenLabs TTS clásico (opcional) | Una API Key y Voice ID introducidos manualmente en Ajustes |
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
- La página es pública; sin Grant Key ni Claude muestra DEMO. Con JobTread conectado y sin Claude entra al modo directo de solo lectura. Si la URL tiene `?demo=1`, permanece en demo por elección explícita.

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

## JobTread real SIN Claude (modo directo)
En `https://salcedocristhian.github.io/Jarvis/`, configura **Grant key de JobTread** y pulsa **Probar conexiones**. Sin la llave de Claude, la aplicación sale del modo DEMO cuando JobTread está configurado. Usa la URL normal **sin `?demo=1`**.

Preguntas de ejemplo:
- «Muéstrame mis proyectos de JobTread» (hasta 40 recientes, y el total si la API lo devuelve).
- «¿Cómo va 5660 Collins?» (si está entre los proyectos accesibles).
- «¿Qué tareas abiertas tiene Barcelona?» (requiere identificar el trabajo).
- «¿Qué documentos pendientes tiene Barcelona?»

Sin Claude, el sistema interpreta algunas intenciones y ejecuta consultas Pave fijas de **solo lectura**. Muestra tarjetas con datos efectivamente recibidos. No genera respuestas libres con IA ni cifras financieras. Si no aparece un proyecto en los primeros 40, no se afirma que no exista.

**Seguridad:** no publiques ni compartas el Grant Key. En el piloto de GitHub Pages se almacena en `localStorage` del dispositivo y se envía directamente a `api.jobtread.com/pave`; evita equipos compartidos y permisos excesivos. ElevenLabs recibe los textos de las respuestas que narra, así que evita hablar en voz alta datos confidenciales que no quieras enviar al proveedor. Para producción, utiliza el servidor protegido, autenticación por usuario y llaves fuera del navegador.


## Voz ElevenAgents — sin llave de API en el dispositivo

El orbe puede iniciar una conversación real con el agente privado de propósito **Jarvis — MTD Voice Pilot** (ID público de conexión: `agent_9601m7c4t540fh6v6nadake0hsrp`), **distinto** del asistente de residentes de 5660. Tiene la voz `T2sZgOl8ol4kf4u6yM2z` y un modelo LLM administrado por ElevenLabs, **no Claude**. Se limita al origen `salcedocristhian.github.io`, a 25 sesiones/día y dos conversaciones simultáneas; esto es un piloto controlado, no autenticación empresarial.

Desde Ajustes → Voz, elige **ElevenAgents · conversación (sin API Key)** (selección predeterminada en una instalación nueva). Toca el orbe para iniciar la voz y autoriza el micrófono; toca nuevamente para finalizar. Mantener pulsado permite escribir, y el agente también recibe texto. El cliente de ElevenAgents se importa bajo demanda desde `https://esm.sh/@elevenlabs/client@1.36.0?bundle`; requiere Internet y puede fallar si la red bloquea ese proveedor.

**JobTread:** el modelo de voz solo tiene acceso a un herramienta del navegador `jobtread_read`. La herramienta ejecuta las consultas de solo lectura del modo directo previamente implementado y devuelve resúmenes limitados, al tiempo que muestra las tarjetas en el propio dispositivo. **El Grant Key de JobTread sigue siendo necesario** en Ajustes de ese mismo navegador; las credenciales no se sincronizan entre iPhone, Safari, Edge ni WebViews. La herramienta devuelve un error claro si falta la conexión, en lugar de inventar proyectos.

**Privacidad:** el agente procesa las transcripciones y los resúmenes de resultados de JobTread que narra. No recibe el Grant Key, pero puede recibir nombres y detalles de proyectos privados; evita datos sensibles y usa un ambiente de pruebas hasta instalar un backend corporativo con inicio de sesión. El agente tiene audio no grabado y retención de conversaciones de 1 día, según la configuración de ElevenLabs. No publiques secretos en GitHub. Si necesitas acceso real multi-dispositivo sin volver a pegar credenciales, todavía hace falta un servidor autenticado: el sitio GitHub Pages no puede guardar llaves privadas de forma segura.

La opción antigua ElevenLabs TTS con API Key y Voice ID permanece disponible para usuarios que ya la tenían configurada.

## Gmail de solo lectura (piloto con Google OAuth)

El sitio publicado permite conectar **una cuenta de Gmail con consentimiento de Google**, sin guardar contraseña ni token de acceso en GitHub. Con Google conectado, el agente ElevenAgents tiene una herramienta `gmail_read` que consulta **solo remitente, asunto, fecha y un extracto** de hasta cinco correos y muestra tarjetas animadas. Puede interpretar «¿cuáles son mis correos recientes?», «¿qué correos no he leído?» y búsquedas por dirección remitente. **No envía, borra, etiqueta ni modifica correos**, no descarga adjuntos ni hace análisis de archivos PDF todavía.

**Activación requerida por el propietario de Gmail**:
1. En [Google Cloud Console](https://console.cloud.google.com/), crea o elige un proyecto de Google Cloud.
2. Habilita la **Gmail API** en APIs & Services.
3. Configura **Google Auth Platform → Branding / Audience / Data Access**, incluido el ámbito restringido `https://www.googleapis.com/auth/gmail.readonly`; si la aplicación está en modo Testing, agrega el Gmail que vas a utilizar como **test user**. Google podría pedir verificación del proyecto para un uso externo/producción.
4. En **Clients**, crea un cliente **OAuth 2.0 → Web application**. Registra exactamente `https://salcedocristhian.github.io` en **Authorized JavaScript origins**. No incluyas la ruta `/Jarvis` en el origen.
5. Copia el **OAuth Client ID** (identificador público `…apps.googleusercontent.com`) y colócalo en **Jarvis → Ajustes → Google OAuth Client ID**. Pulsa **Conectar Gmail con Google**, elige tu cuenta y autoriza el acceso **solo lectura**.
6. Luego pregunta con el orbe: «Jarvis, dime cuáles son mis últimos correos de Gmail».

**Seguridad y límites:** Google Identity Services controla el consentimiento. Solo guardamos el *OAuth Client ID público* en `localStorage`. El token de acceso temporal existe **solo en memoria**, expira y se pierde al cerrar/actualizar la página. No se almacena una contraseña, un refresh token ni un client secret. Las respuestas habladas comparten extractos y asuntos de mensajes con ElevenLabs; no uses esta prueba con correo confidencial que no desees compartir con el proveedor. Google puede restringir el acceso a ámbitos de Gmail o solicitar verificación; este código **no equivale a una conexión activada** hasta que el titular configure OAuth y apruebe el permiso. Para acceso privado permanente entre iPhone/Edge y lecturas en segundo plano se requiere backend con OAuth de servidor y autenticación propia, no GitHub Pages estático.

## Reparación: tarjetas de JobTread con voz ElevenAgents

Los registros de la conversación de Jarvis mostraron que la herramienta `jobtread_read` sí recibió datos de la organización, pero el agente a veces terminó el turno sin narrar. El prompt de ElevenAgents ahora obliga a leer el texto verificado después de cada herramienta, y el cliente tiene un segundo mecanismo de narración si el modelo no produce respuesta oral tras el retorno de la consulta. No vuelve a pedir los datos ni inventa cifras. Además, la consulta usa filtros `where: ["name","like","%término%"]` del Pave API para encontrar proyectos fuera de los 40 más recientes; si no hay coincidencia confirmada, indica que no pudo localizarlo en vez de sustituirlo por otro.

La búsqueda de proyectos y Gmail están diseñadas para **solo lectura**. Las pruebas automáticas usan datos simulados, nunca las llaves reales del usuario; la prueba final de micrófono y OAuth debe hacerse desde Safari o Edge.


## Escucha continua manos libres (iPhone / Safari)

La página principal de Jarvis incluye un botón visible **Activar manos libres** debajo del orbe. Tócalo una vez, acepta el micrófono y habla normalmente: la sesión de ElevenAgents permanece abierta entre turnos y sigue escuchando después de cada respuesta. No hay que mantener pulsado ni volver a tocar el orbe por cada pregunta. Puedes decir «Jarvis, revisa mis correos no leídos», escuchar la respuesta y luego «Busca las tareas abiertas de 5660 Collins» en la misma conversación. El botón cambia a **Detener escucha** y un punto verde indica que el micrófono está activo.

**Permisos y control:** el navegador exige una acción explícita para abrir la primera sesión de micrófono; la aplicación NO inicia grabación silenciosamente al abrirse, y NO puede escuchar permanentemente con Safari cerrado, con el iPhone bloqueado o en segundo plano. Cuando la página queda oculta, se finaliza la sesión deliberadamente. Al regresar verás **Reanudar escucha** y deberás tocarlo. La preferencia se recuerda, pero nunca se reabre el micrófono sin ese toque. Desactivar el modo cierra la sesión. La sesión se puede interrumpir por red, sistema o límite del proveedor; después exige reanudar manualmente.

**Privacidad y costos:** la conversación abierta transmite voz a ElevenLabs, incluso la voz ambiente mientras esté activa. No hay reconocimiento privado/local de una palabra de activación «Jarvis»; no se debe presentar como un sistema 24/7 ni escuchar conversaciones ajenas sin permiso. El piloto ElevenAgents tiene límites de uso y consumo por duración de sesión; detén la escucha cuando no la necesites. El navegador móvil puede volver a pedir permiso al relanzar una app añadida a la pantalla de inicio.

Esta función no modifica el acceso de Gmail ni el Grant Key de JobTread y solo está implementada en la página principal de GitHub Pages. La variante del servidor mantiene su experiencia de voz anterior hasta que se adapte de forma específica.

## Data Studio UX — Motion Graphics + Gmail + JobTread (noviembre de 2026)

La consulta oral muestra primero un **titular cinético y contador**; al mismo tiempo aparece un explorador navegable en el iPhone con animaciones escalonadas, iluminación de cristal, barra de búsqueda y botón **Cargar más resultados**. El acento de color reacciona a `speaking`/`listening` de ElevenAgents. La pantalla se adapta a iPhone pequeño y reduce animaciones cuando el sistema utiliza `prefers-reduced-motion`. Estas animaciones representan datos consultados: ningún indicador visual representa una aprobación o progreso inferido.

**Gmail:** el modo lectura OAuth recupera 20 mensajes por página de forma predeterminada (hasta 30 si pides una lista completa); la API de lectura permite solicitar páginas siguientes y abrir el **texto completo** de un mensaje con un toque (solo si Google lo entrega). La búsqueda detecta «sin leer», «enviados», el remitente de una dirección de correo o un nombre mencionado después de «correo de ...». Las cifras `resultSizeEstimate` de Google se etiquetan como aproximadas. Los cuerpos y tokens no se transmiten al modelo de voz al listar mensajes; la voz solo recibe el resumen verbal. No hay envío ni modificación de correos y los adjuntos todavía no se abren.

**JobTread:** se consultan proyectos paginados de 30 registros por página (no solo los primeros 4), con el total exacto cuando JobTread lo proporcione. Se puede filtrar visualmente la página ya cargada, abrir la ficha de un proyecto y consultar descripción, tareas, documentos **de todos los estados**, archivos y registros diarios. Los filtros de pendientes se aplican únicamente cuando la pregunta pide pendientes. Una consulta financiera sobre un proyecto específico puede mostrar valores individuales `projectedPrice`, `projectedCost` y `actualCost`, tal como los devuelva JobTread; no calcula saldos o compromisos faltantes ni inventa cifras. «Todos los proyectos» se recorren por páginas a través de `nextPage`, sin descargar cientos de registros de golpe.

**Accesibilidad:** controles de al menos 40–44 px, textos legibles y navegación manual; las listas mantienen su posición de desplazamiento y todos los textos externos se presentan como `textContent` (sin evaluar HTML). El movimiento complementa, pero no reemplaza, el acceso a datos. Los resultados son de solo lectura. Las llaves locales no se publican en GitHub.

**Estado del piloto:** validado con pruebas automatizadas y registros simulados. La comprobación real de nuevas vistas y permisos sigue requiriendo abrir la versión publicada en Safari o Edge con las conexiones del usuario.


## Motion Engine V2 — Gmail / JobTread / Budget (14 Nov 2026)

La pantalla inicial continúa minimalista: **orbe, Menú y Ajustes**. Después de cada consulta autorizada, el explorador de registros aparece con una de tres escenas cinematográficas **generadas con HTML/CSS y los datos fuente reales**, no capturas ni videos precocinados:

- **Gmail:** un sobre 3D estilizado se abre y extrae un papel holográfico. El asunto y remitente mostrado provienen del primer mensaje obtenido mediante el OAuth de Gmail. Se mantiene la lista real de correos y el botón para abrir el mensaje completo; no inventa archivos adjuntos.
- **JobTread:** una estructura de líneas *conceptual* sube del escáner y está rotulada explícitamente **no es un plano del edificio**. El nombre, estado y módulos provienen de los registros reales de JobTread; el listado paginado y las fichas siguen funcionando.
- **Budget:** tres nodos animados muestran los campos de fuente `Projected Price`, `Projected Cost` y `Actual Cost` solamente cuando la consulta autorizada los devuelve. No se supone que representen partidas excluyentes de una misma bolsa ni se calcula un saldo/restante inferido.

Cada escena incluye animación de entrada, escaneo, iluminación, efectos de profundidad, etiquetas de origen y acción para abrir un registro. Las escenas se adaptan al estado de voz `listening`/`speaking` y a pantallas pequeñas. Respetan tanto `prefers-reduced-motion` de iOS como **Ajustes → Movimiento → Calmado**.

La app sigue siendo lectura de solo Gmail/JobTread: no se añaden claves, permisos ni llamadas a servicios; los textos externos se insertan con `textContent`, sin interpretar HTML de terceros. El Motion Engine es una interpretación visual de registros consultados, **no sustituye los planos, el presupuesto original ni la evidencia verificable**. Se prueba con fixtures inventados únicamente en test, nunca publicados como información del usuario.

Archivos: `public/jarvis-motion.js`, `public/jarvis-motion.css`, `test/motion-v2.mjs`. La inspección visual final debe hacerse en Safari/iPhone para validar contraste, rendimiento y accesibilidad.

## Motion V3: la malla escribe las respuestas

El fondo de malla y el polvo suspendido ahora forman parte de cada respuesta (`public/jarvis-motion.js` y `public/jarvis-motion.css`). Cada tipo de cuadro tiene su propia física:

| Cuadro | Animación |
|---|---|
| Titular | La malla y el polvo vuelan y escriben el texto con partículas; al llegar, una onda recorre el terreno. |
| Cifra | El terreno se levanta detrás del número. |
| Evidencia, fuente, registro | Un cabezal láser traza el contorno y luego cada línea, como un plotter de planos. |
| Acción | Marco mecánico que se ensambla, compuertas que se abren y carga por celdas. |
| Gmail | Los correos caen del orbe como hojas de papel. |
| Cifras de JobTread | Terreno con una montaña por cifra, proporcional al valor; las etiquetas son el texto exacto de JobTread. |
| Proyecto con modelo 3D | 5660 Collins: torre real con la silueta de los planos RELATS. Barcelona Gardens: conjunto real con las marcas de NV5 y barrido de radar. |
| Lista de proyectos | Constelación con un punto por proyecto (las posiciones no significan nada). |

Además: mandala detrás del orbe mientras Jarvis consulta, y el anillo del orbe sigue el volumen real de la voz de ElevenAgents (`getOutputVolume` y `getOutputByteFrequencyData` del SDK, solo lectura).

**Modelos 3D reales, solo lectura.** Jarvis lee `jarvis-model.json` desde `raw.githubusercontent.com/salcedocristhian/5660-collins-app/main/` y `.../Barcelona/main/`, y las marcas desde `Barcelona/main/data/nv5-repair-marks.json`. Si no los encuentra, usa la copia guardada en `public/model-5660-collins.json` y `public/model-barcelona.json`, y lo dice en pantalla. Jarvis nunca escribe en esos repositorios. Los datos se validan antes de dibujarlos y todo el texto externo entra como texto, nunca como HTML.

**Modo calmado.** Con "Movimiento: calmado" o con la reducción de movimiento del sistema, no hay partículas ni mandala; el contenido aparece directo.

**Estudio.** `motion-lab.html` es la galería de todas las animaciones con datos de ejemplo (DEMO).

La variante `servidor/` mantiene su interfaz anterior; Motion V3 vive en la app publicada (`index.html`).


## Investigación pública con Gemini (opcional)

Jarvis incluye un bridge privado para consultar Google Search desde el orbe y mostrar enlaces verificables. No se publica una Gemini API key en el navegador ni se envían mensajes privados a una búsqueda pública. **No está activo hasta desplegar y configurar el Worker de Cloudflare**. Ver [docs/RESEARCH-SETUP.md](docs/RESEARCH-SETUP.md).
