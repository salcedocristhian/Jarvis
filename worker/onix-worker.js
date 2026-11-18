/* ÓNIX server on Cloudflare Workers (free plan).
   Jobs:
   1. Know who is asking: the phone sends its Google or Microsoft access token; we ask Google/Microsoft whose it is.
      The token is never stored; only a SHA-256 of it, for 10 minutes, so we don't ask on every request.
   2. Guard the ElevenLabs minutes: hand out a private voice link (signed URL) only while there is budget,
      count the seconds, stop guests at their daily and monthly limits. The ElevenLabs key lives only here, as a secret.
   3. Free text AI when the premium voice is used up: Cloudflare Workers AI (does not train on your data).
      Web questions go to Brave Search. Gemini is only a backup and never gets the person's email or calendar.
   Secrets (wrangler secret put …): ELEVENLABS_API_KEY, BRAVE_API_KEY (optional), GEMINI_API_KEY (optional)
   Variables (wrangler.toml [vars]): see DEFAULTS below. Bindings: ONIX_KV (KV namespace), AI (Workers AI). */

const DEFAULTS = {
  ALLOWED_ORIGIN: "https://salcedocristhian.github.io",
  AGENT_ID: "agent_9601m7c4t540fh6v6nadake0hsrp",
  ADMIN_HASHES: "192415de7da4a638b541cfd10a9ae75cd79a2d52463f27ee4bfa0629cb4565f2",
  GUEST_DAILY_SECONDS: "60",      // premium voice per guest per day
  GUEST_MONTH_SECONDS: "6000",    // all guests together per month (100 min). The rest of the plan stays for admins.
  PERMIT_DEPOSIT_SECONDS: "20",   // charged up front on every voice start, so skipped reports still cost something
  ASK_DAILY: "80",                // free text answers per person per day
  AI_MODEL: "@cf/meta/llama-3.1-8b-instruct",
  GEMINI_MODEL: "gemini-2.5-flash"
};
const cfg = (env, k) => String(env?.[k] ?? DEFAULTS[k]);
const num = (env, k) => Number(cfg(env, k)) || 0;

const enc = new TextEncoder();
async function sha256(s){ const b = await crypto.subtle.digest("SHA-256", enc.encode(String(s))); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

function cors(env, req){
  const origin = req.headers.get("Origin") || "";
  const allowed = cfg(env, "ALLOWED_ORIGIN").split(",").map(s => s.trim());
  return { "Access-Control-Allow-Origin":allowed.includes(origin) ? origin : allowed[0], "Access-Control-Allow-Methods":"POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type", "Access-Control-Max-Age":"86400", "Vary":"Origin" };
}
const json = (env, req, body, status = 200) => new Response(JSON.stringify(body), { status, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store", ...cors(env, req) } });

/* ---------- who is this? ---------- */
async function identify(env, provider, token){
  if(!token || typeof token !== "string" || token.length > 4096) throw httpError(401, "Sign in again.");
  const key = "id:" + await sha256(provider + ":" + token);
  const hit = await env.ONIX_KV.get(key, "json");
  if(hit) return hit;
  let email = "", name = "";
  if(provider === "google"){
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers:{ Authorization:"Bearer " + token } });
    if(!r.ok) throw httpError(401, "Google didn't recognize this sign-in. Reconnect.");
    const me = await r.json(); if(me.email_verified === false) throw httpError(401, "Unverified Google email.");
    email = me.email; name = me.given_name || me.name || "";
  } else if(provider === "microsoft"){
    const r = await fetch("https://graph.microsoft.com/v1.0/me?$select=givenName,displayName,mail,userPrincipalName", { headers:{ Authorization:"Bearer " + token } });
    if(!r.ok) throw httpError(401, "Microsoft didn't recognize this sign-in. Reconnect.");
    const me = await r.json(); email = me.mail || me.userPrincipalName; name = me.givenName || me.displayName || "";
  } else throw httpError(400, "Unknown provider.");
  email = String(email || "").trim().toLowerCase();
  if(!email.includes("@")) throw httpError(401, "No email on that account.");
  const hash = await sha256(email);
  const who = { hash, name:String(name).slice(0, 40), admin:cfg(env, "ADMIN_HASHES").split(",").map(s => s.trim()).includes(hash) };
  await env.ONIX_KV.put(key, JSON.stringify(who), { expirationTtl:600 });
  return who;
}
function httpError(status, message){ const e = new Error(message); e.status = status; return e; }

/* ---------- voice budget ---------- */
async function usage(env, who){
  const [day, guestsMonth] = await Promise.all([env.ONIX_KV.get(`day:${who.hash}:${today()}`), env.ONIX_KV.get(`gm:${month()}`)]);
  return { day:Number(day) || 0, guestsMonth:Number(guestsMonth) || 0 };
}
async function charge(env, who, seconds){
  const s = Math.max(0, Math.min(30, Math.round(Number(seconds) || 0)));
  if(!s) return;
  const u = await usage(env, who);
  await env.ONIX_KV.put(`day:${who.hash}:${today()}`, String(u.day + s), { expirationTtl:172800 });
  const allKey = `all:${month()}`, all = Number(await env.ONIX_KV.get(allKey)) || 0;
  await env.ONIX_KV.put(allKey, String(all + s), { expirationTtl:3456000 });
  if(!who.admin) await env.ONIX_KV.put(`gm:${month()}`, String(u.guestsMonth + s), { expirationTtl:3456000 });
}
function secondsLeft(env, who, u){
  if(who.admin) return -1;
  return Math.max(0, Math.min(num(env, "GUEST_DAILY_SECONDS") - u.day, num(env, "GUEST_MONTH_SECONDS") - u.guestsMonth));
}
async function permit(env, who){
  const u = await usage(env, who), left = secondsLeft(env, who, u);
  if(left === 0) return { ok:false, reason:u.guestsMonth >= num(env, "GUEST_MONTH_SECONDS") ? "month" : "day", secondsLeft:0 };
  await charge(env, who, num(env, "PERMIT_DEPOSIT_SECONDS"));
  let signedUrl = null;
  if(env.ELEVENLABS_API_KEY){
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(cfg(env, "AGENT_ID"))}`, { headers:{ "xi-api-key":env.ELEVENLABS_API_KEY } });
    if(!r.ok) throw httpError(502, "ElevenLabs didn't answer. Try again.");
    signedUrl = (await r.json()).signed_url || null;
  }
  return { ok:true, signedUrl, secondsLeft:who.admin ? -1 : Math.max(0, left - num(env, "PERMIT_DEPOSIT_SECONDS")), admin:who.admin };
}

/* ---------- free AI ---------- */
const SYSTEM = `You are ÓNIX, a sarcastic but genuinely useful personal assistant on a phone. Speak English, short answers (1-3 sentences) unless asked for more.
Sarcasm is for the chat only: anything written for someone else (an email, a message) is plain and professional.
You only know what's in CONTEXT and this chat. Never invent emails, meetings, numbers or names.
If you need current information from the web, reply with exactly one line: SEARCH: <query>`;
async function braveSearch(env, q){
  if(!env.BRAVE_API_KEY) throw httpError(501, "Web search isn't set up yet.");
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=5&q=${encodeURIComponent(String(q).slice(0, 200))}`, { headers:{ Accept:"application/json", "X-Subscription-Token":env.BRAVE_API_KEY } });
  if(!r.ok) throw httpError(502, "Web search is busy. Try again.");
  const d = await r.json();
  return (d.web?.results || []).slice(0, 5).map(x => ({ title:String(x.title || "").slice(0, 140), url:String(x.url || ""), snippet:String(x.description || "").replace(/<[^>]+>/g, "").slice(0, 300) }));
}
function cleanMessages(messages){
  return (Array.isArray(messages) ? messages : []).slice(-10).map(m => ({ role:m?.role === "assistant" ? "assistant" : "user", content:String(m?.content || "").slice(0, 2000) })).filter(m => m.content);
}
async function workersAI(env, msgs){
  const r = await env.AI.run(cfg(env, "AI_MODEL"), { messages:msgs, max_tokens:350 });
  return String(r?.response ?? r?.result?.response ?? "").trim();
}
async function gemini(env, msgs){
  // Backup only, and without CONTEXT: Gemini's free tier may train on what it receives.
  const contents = msgs.filter(m => m.role !== "system").map(m => ({ role:m.role === "assistant" ? "model" : "user", parts:[{ text:m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg(env, "GEMINI_MODEL"))}:generateContent`, {
    method:"POST", headers:{ "Content-Type":"application/json", "x-goog-api-key":env.GEMINI_API_KEY },
    body:JSON.stringify({ systemInstruction:{ parts:[{ text:SYSTEM }] }, contents, generationConfig:{ maxOutputTokens:350 } }) });
  if(!r.ok) throw httpError(502, "The backup AI is busy.");
  const d = await r.json();
  return String(d.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "").trim();
}
async function ask(env, who, body){
  const key = `ask:${who.hash}:${today()}`, used = Number(await env.ONIX_KV.get(key)) || 0;
  if(!who.admin && used >= num(env, "ASK_DAILY")) return { ok:false, reply:"I've talked enough for one day. Even I have limits. Tomorrow." };
  await env.ONIX_KV.put(key, String(used + 1), { expirationTtl:172800 });
  const chat = cleanMessages(body.messages);
  if(!chat.length) throw httpError(400, "Say something.");
  const context = String(body.context || "").slice(0, 4000);
  const name = String(body.name || who.name || "").slice(0, 40);
  const sys = { role:"system", content:SYSTEM + `\nThe person's name: ${name || "unknown"}. Role: ${who.admin ? "admin" : "guest"}.` + (context ? `\nCONTEXT (their own accounts, read just now):\n${context}` : "") };
  let reply = "", sources = [], engine = "workers-ai";
  try {
    reply = await workersAI(env, [sys, ...chat]);
    const s = reply.match(/^\s*SEARCH:\s*(.+)$/im);
    if(s){
      sources = await braveSearch(env, s[1]).catch(() => []);
      const res = sources.length ? sources.map((x, i) => `[${i + 1}] ${x.title} — ${x.snippet} (${x.url})`).join("\n") : "No results.";
      reply = await workersAI(env, [sys, ...chat, { role:"system", content:`WEB RESULTS for "${s[1]}":\n${res}\nAnswer from these only and name the source site.` }]);
    }
  } catch(e){
    if(!env.GEMINI_API_KEY) throw httpError(503, "My free brain is out for today. Try again later.");
    engine = "gemini"; reply = await gemini(env, chat);
  }
  reply = reply.replace(/^\s*SEARCH:.*$/im, "").trim();
  if(!reply) reply = sources.length ? `Here's what the web says: ${sources[0].snippet} (${new URL(sources[0].url).hostname})` : "I came up empty. Ask me another way.";
  return { ok:true, reply:reply.slice(0, 1500), sources, engine };
}

/* ---------- router ---------- */
export default {
  async fetch(req, env){
    if(req.method === "OPTIONS") return new Response(null, { status:204, headers:cors(env, req) });
    const url = new URL(req.url);
    if(req.method === "GET" && url.pathname === "/health") return json(env, req, { ok:true, kv:Boolean(env.ONIX_KV), ai:Boolean(env.AI), voice:Boolean(env.ELEVENLABS_API_KEY), web:Boolean(env.BRAVE_API_KEY) });
    if(req.method !== "POST") return json(env, req, { ok:false, error:"Not found." }, 404);
    const origin = req.headers.get("Origin") || "";
    if(!cfg(env, "ALLOWED_ORIGIN").split(",").map(s => s.trim()).includes(origin)) return json(env, req, { ok:false, error:"Origin not allowed." }, 403);
    try {
      const body = await req.json().catch(() => ({}));
      const who = await identify(env, body.provider, body.token);
      switch(url.pathname){
        case "/voice/permit": return json(env, req, await permit(env, who));
        case "/voice/used": { await charge(env, who, body.seconds); const u = await usage(env, who); return json(env, req, { ok:true, secondsLeft:secondsLeft(env, who, u) }); }
        case "/ask": return json(env, req, await ask(env, who, body));
        case "/search": return json(env, req, { ok:true, results:await braveSearch(env, body.query) });
        default: return json(env, req, { ok:false, error:"Not found." }, 404);
      }
    } catch(e){
      return json(env, req, { ok:false, error:String(e.message || e).slice(0, 200) }, e.status || 500);
    }
  }
};
