// Una — servidor local sin dependencias (Node 18+).
// Sirve /public y expone una API pequeña. Las llaves viven solo aquí, nunca en el navegador.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/* ---------- .env (parser mínimo, sin dependencias) ---------- */
const envFile = path.join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
const cfg = {
  port: Number(process.env.PORT || 5173),
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  jtKey: process.env.JOBTREAD_GRANT_KEY || "",
  elevenKey: process.env.ELEVENLABS_API_KEY || "",
  elevenVoice: process.env.ELEVENLABS_VOICE_ID || "",
  elevenModel: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
  passcode: process.env.APP_PASSCODE || "",
  pinned: (process.env.PINNED_JOBS || "")
    .split(",").map(s => s.trim()).filter(Boolean)
    .map(s => { const [id, ...rest] = s.split("|"); return { id: id.trim(), label: (rest.join("|") || id).trim() }; }),
};

/* ---------- utilidades ---------- */
const send = (res, code, body, type = "application/json; charset=utf-8") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((ok, fail) => {
  let data = ""; req.on("data", c => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on("end", () => { try { ok(data ? JSON.parse(data) : {}); } catch (e) { fail(e); } });
  req.on("error", fail);
});
const authorized = req => !cfg.passcode || req.headers["x-una-passcode"] === cfg.passcode;
const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ---------- JobTread (solo lectura) ---------- */
let orgId = null;
function guardReadOnly(q) {
  if (!q || typeof q !== "object") throw new Error("La consulta debe ser un objeto JSON.");
  const bad = Object.keys(q).find(k => /^(create|update|delete|send|upsert|copy|import|approve|void)/i.test(k));
  if (bad) throw new Error(`"${bad}" modifica datos. Una solo lee de JobTread.`);
}
async function jobtread(query) {
  if (!cfg.jtKey) throw new Error("JobTread no está conectado (falta JOBTREAD_GRANT_KEY).");
  guardReadOnly(query);
  const r = await fetch("https://api.jobtread.com/pave", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: { $: { grantKey: cfg.jtKey }, ...query } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`JobTread respondió ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function ensureOrg() {
  if (orgId) return orgId;
  const d = await jobtread({ currentGrant: { organization: { id: {}, name: {} } } });
  orgId = d.currentGrant.organization.id;
  return orgId;
}

/* ---------- Claude: bucle de herramientas ---------- */
const TOOLS = [
  {
    name: "jobtread_query",
    description: "Consulta de SOLO LECTURA a la API Pave de JobTread (JSON tipo GraphQL). Pasa el objeto de consulta completo en 'query' (sin grantKey).",
    input_schema: { type: "object", properties: { query: { type: "object" } }, required: ["query"] },
  },
];
function systemPrompt({ lang, owner, name }) {
  const now = new Date();
  return `Eres ${name}, la asistente personal de ${owner}, que trabaja en construcción en Florida. Te habla por voz desde el celular.
Idioma: responde en ${lang.startsWith("en") ? "inglés" : "español"} salvo que te hablen en otro idioma.
Tono: cálido, directo, frases cortas y seguras. Nada de relleno.
No inventes datos. Todo dato de proyectos sale de jobtread_query. Si algo falla o no está conectado, dilo en una frase.
Hoy: ${now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

JobTread: organizationId = "${orgId || "desconocido; pídelo con {\"currentGrant\":{\"organization\":{\"id\":{}}}}"}".
Proyectos fijos: ${cfg.pinned.map(p => `${p.label} (job id ${p.id})`).join("; ") || "ninguno configurado"}.
Sintaxis Pave: argumentos bajo "$", escalares con {}. Ejemplos:
{"job":{"$":{"id":"JOB_ID"},"name":{},"number":{},"tasks":{"$":{"size":10,"where":["progress","!=",1]},"count":{},"nodes":{"name":{},"endDate":{}}},"documents":{"$":{"size":10,"sortBy":[{"field":"issueDate","order":"desc"}]},"count":{},"nodes":{"fullName":{},"type":{},"status":{},"issueDate":{},"priceWithTax":{},"balance":{}}}}}
{"organization":{"$":{"id":"ORG_ID"},"jobs":{"$":{"size":20,"where":["closedOn",null],"sortBy":[{"field":"createdAt","order":"desc"}]},"count":{},"nodes":{"id":{},"name":{},"number":{},"status":{}}}}}
Tipos de documento: customerOrder, customerInvoice, vendorOrder, vendorBill. Para ver campos: {"schema":{"$":{"path":"root.job","expand":true}}}.

FORMATO DE RESPUESTA FINAL: devuelve SOLO un objeto JSON, sin texto alrededor ni bloques de código:
{
 "speech": "lo que dirás en voz alta: 1 a 3 frases naturales, sin listas, cifras redondeadas como se dicen",
 "frames": [ 2 a 5 cuadros que acompañan la voz, en este orden lógico:
   {"type":"headline","text":"Titular corto con punto final."},
   {"type":"number","value":4735.69,"format":"usd"|"count","label":"qué es esa cifra"},
   {"type":"evidence","title":"documento, tarea o dato concreto","detail":"una línea","source":"JobTread"},
   {"type":"action","text":"La única cosa que conviene hacer ahora."} ],
 "closer": "una línea seca e ingeniosa, opcional",
 "project": "id del job si la respuesta es sobre uno, o null"
}
Usa "number" solo con cifras reales que consultaste. Si solo es charla, basta un "headline" y "speech".`;
}
function parseFinal(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      const j = JSON.parse(clean.slice(a, b + 1));
      if (typeof j.speech === "string") return { speech: j.speech, frames: Array.isArray(j.frames) ? j.frames.slice(0, 6) : [], closer: j.closer || "", project: j.project || null };
    } catch { /* cae al texto plano */ }
  }
  return { speech: clean, frames: [{ type: "headline", text: clean.split(/(?<=[.!?])\s/)[0] }], closer: "", project: null };
}
async function ask({ messages, lang = "es", owner = "Chris", name = "Una" }) {
  if (!cfg.anthropicKey) throw Object.assign(new Error("Falta ANTHROPIC_API_KEY en .env."), { code: "not_connected" });
  if (cfg.jtKey) { try { await ensureOrg(); } catch (e) { log("JobTread org:", e.message); } }
  const convo = messages.slice(-12).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }));
  const sources = new Set();
  for (let step = 0; step < 7; step++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cfg.anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1500, system: systemPrompt({ lang, owner, name }), messages: convo, tools: cfg.jtKey ? TOOLS : [] }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Claude respondió ${r.status}: ${data?.error?.message || "error"}`);
    convo.push({ role: "assistant", content: data.content });
    if (data.stop_reason !== "tool_use") {
      const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      return { ...parseFinal(text), sources: [...sources] };
    }
    const results = [];
    for (const block of data.content.filter(b => b.type === "tool_use")) {
      let content, is_error = false;
      try {
        if (block.name !== "jobtread_query") throw new Error("Herramienta desconocida.");
        content = JSON.stringify(await jobtread(block.input.query)).slice(0, 15000);
        sources.add("JobTread");
      } catch (e) { content = String(e.message || e); is_error = true; }
      results.push({ type: "tool_result", tool_use_id: block.id, content, is_error });
    }
    convo.push({ role: "user", content: results });
  }
  return { speech: "Me enredé consultando. Pregúntamelo de otra forma.", frames: [{ type: "headline", text: "Me enredé." }], closer: "", sources: [...sources] };
}

/* ---------- Proyectos fijos (satélites) ---------- */
async function projects() {
  if (!cfg.jtKey || !cfg.pinned.length) return [];
  return Promise.all(cfg.pinned.map(async p => {
    try {
      const d = await jobtread({ job: { $: { id: p.id }, name: {}, number: {}, status: {},
        tasks: { $: { where: ["progress", "!=", 1] }, count: {} },
        pending: { _: "documents", $: { where: ["status", "in", ["pending", "draft"]] }, count: {} },
        bills: { _: "documents", $: { where: { and: [["type", "vendorBill"], ["balance", ">", 0]] } }, sum: { $: "balance" } } } });
      const j = d.job;
      return { id: p.id, label: p.label, name: j.name, number: j.number, status: j.status, openTasks: j.tasks.count, pendingDocs: j.pending.count, payable: j.bills.sum || 0, urgent: j.pending.count > 0 };
    } catch (e) { return { id: p.id, label: p.label, error: e.message }; }
  }));
}

/* ---------- ElevenLabs ---------- */
async function tts(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.elevenVoice)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": cfg.elevenKey, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: String(text).slice(0, 2500), model_id: cfg.elevenModel }),
  });
  if (!r.ok) throw new Error(`ElevenLabs respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

/* ---------- servidor ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/status") {
      return send(res, 200, {
        claude: cfg.anthropicKey ? "connected" : "not_connected",
        jobtread: cfg.jtKey ? "connected" : "not_connected",
        elevenlabs: cfg.elevenKey && cfg.elevenVoice ? "connected" : "not_connected",
        outlook: "not_connected",
        passcode: !!cfg.passcode,
      });
    }
    if (url.pathname.startsWith("/api/") && !authorized(req)) return send(res, 401, { error: "Código incorrecto." });
    if (url.pathname === "/api/projects") return send(res, 200, await projects());
    if (url.pathname === "/api/ask" && req.method === "POST") {
      const body = await readBody(req);
      const t0 = Date.now();
      const out = await ask(body);
      log("ask", `${Date.now() - t0}ms`, out.sources.join(",") || "sin fuentes");
      return send(res, 200, out);
    }
    if (url.pathname === "/api/tts" && req.method === "POST") {
      if (!cfg.elevenKey || !cfg.elevenVoice) return send(res, 409, { error: "ElevenLabs no está conectado." });
      const { text } = await readBody(req);
      return send(res, 200, await tts(text), "audio/mpeg");
    }
    if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "No existe." });

    // estáticos
    const rel = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const file = path.normalize(path.join(ROOT, "public", rel));
    if (!file.startsWith(path.join(ROOT, "public"))) return send(res, 403, "Prohibido", "text/plain");
    try { return send(res, 200, await readFile(file), MIME[path.extname(file)] || "application/octet-stream"); }
    catch { return send(res, 404, "No encontrado", "text/plain"); }
  } catch (e) {
    log("error", url.pathname, e.message);
    return send(res, e.code === "not_connected" ? 409 : 500, { error: e.message, code: e.code || "error" });
  }
});
server.listen(cfg.port, () => {
  log(`Una escuchando en http://localhost:${cfg.port}`);
  log(`Claude ${cfg.anthropicKey ? "✓" : "✗"} · JobTread ${cfg.jtKey ? "✓" : "✗"} · ElevenLabs ${cfg.elevenKey && cfg.elevenVoice ? "✓" : "✗"} · proyectos fijos: ${cfg.pinned.length}`);
});
