// ÓNIX worker: identity, voice budget, private voice link, free AI with web search, origin lock.
import assert from "node:assert/strict";
import worker from "../worker/onix-worker.js";
import { createHash } from "node:crypto";

const hash = s => createHash("sha256").update(s).digest("hex");
const ORIGIN = "https://salcedocristhian.github.io";
function kv(){ const m = new Map(); return { m, async get(k, t){ const v = m.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : t === "arrayBuffer" ? v : String(v); }, async put(k, v){ m.set(k, typeof v === "string" ? v : v instanceof ArrayBuffer ? v : String(v)); } }; }
const calls = [], ttsCalls = [];
const people = { "tok-guest":{ email:"douglas@gmail.com", given_name:"Douglas", email_verified:true }, "tok-admin":{ email:"Chris@Example.com", given_name:"Chris", email_verified:true } };
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); calls.push({ url, opts });
  const ok = b => new Response(JSON.stringify(b), { status:200, headers:{ "Content-Type":"application/json" } });
  if(url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")){ const p = people[(opts.headers?.Authorization || "").slice(7)]; return p ? ok(p) : new Response("{}", { status:401 }); }
  if(url.startsWith("https://api.elevenlabs.io/v1/convai/agents/")) return ok({ conversation_config:{ tts:{ voice_id:"VOICE123", model_id:"eleven_flash_v2" } } });
  if(url.startsWith("https://api.elevenlabs.io/v1/text-to-speech/")){ ttsCalls.push(JSON.parse(opts.body)); assert.match(url, /VOICE123/); return new Response(new Uint8Array([73, 68, 51, 1, 2, 3]), { status:200, headers:{ "Content-Type":"audio/mpeg" } }); }
  if(url.startsWith("https://api.elevenlabs.io/")){ assert.equal(opts.headers["xi-api-key"], "xi-secret"); return ok({ signed_url:"wss://api.elevenlabs.io/v1/convai/conversation?agent_id=x&conversation_signature=abc" }); }
  if(url.startsWith("https://api.search.brave.com/")) return ok({ web:{ results:[{ title:"Miami-Dade permits", url:"https://www.miamidade.gov/permits", description:"Permit <b>hours</b> 8–4." }] } });
  if(url.includes("generativelanguage.googleapis.com")) return ok({ candidates:[{ content:{ parts:[{ text:"Backup answer." }] } }] });
  throw new Error("unexpected fetch " + url);
};
let aiCalls = [];
const env = { ONIX_KV:kv(), ELEVENLABS_API_KEY:"xi-secret", BRAVE_API_KEY:"brave", ADMIN_HASHES:hash("chris@example.com"),
  AI:{ async run(model, { messages }){ aiCalls.push(messages); const last = messages[messages.length - 1].content;
    if(/WEB RESULTS/.test(last)) return { response:"8 to 4, says miamidade.gov. Thrilling." };
    if(/permit office/i.test(last)) return { response:"SEARCH: Miami-Dade permit office hours" };
    return { response:"Sure. Done pretending." }; } } };
const post = (path, body, origin = ORIGIN) => worker.fetch(new Request("https://onix.workers.dev" + path, { method:"POST", headers:{ "Content-Type":"application/json", Origin:origin }, body:JSON.stringify(body) }), env).then(async r => ({ status:r.status, body:await r.json(), headers:r.headers }));

// Origin lock and bad tokens
assert.equal((await post("/voice/permit", { provider:"google", token:"tok-guest" }, "https://evil.example")).status, 403);
assert.equal((await post("/voice/permit", { provider:"google", token:"nope" })).status, 401);

// One voice everywhere: welcome lines before sign-in, cached after the first time
const tts = (body, origin = ORIGIN) => worker.fetch(new Request("https://onix.workers.dev/tts", { method:"POST", headers:{ "Content-Type":"application/json", Origin:origin }, body:JSON.stringify(body) }), env);
let a = await tts({ text:"Hi. I'm Onix, your new personal assistant." });
assert.equal(a.status, 200); assert.equal(a.headers.get("Content-Type"), "audio/mpeg"); assert.equal((await a.arrayBuffer()).byteLength, 6);
a = await tts({ text:"Hi. I'm Onix,   your new personal assistant. " });
assert.equal(a.status, 200); assert.equal(ttsCalls.length, 1, "same line again comes from the cache: no new credits");
assert.equal(ttsCalls[0].model_id, "eleven_flash_v2", "same voice and model as the agent");
assert.equal((await tts({ text:"x".repeat(300) })).status, 401, "long lines need sign-in");
assert.equal((await tts({ text:"hello" }, "https://evil.example")).status, 403);
env.TTS_DAILY_CHARS = "30";
assert.equal((await tts({ text:"Evening, Doug. 14 unread.", provider:"google", token:"tok-guest" })).status, 200);
assert.equal((await tts({ text:"And this one goes over the limit.", provider:"google", token:"tok-guest" })).status, 429, "guest daily voice limit");
assert.equal((await tts({ text:"And this one goes over the limit.", provider:"google", token:"tok-admin" })).status, 200, "admin has no voice limit");
delete env.TTS_DAILY_CHARS;

// Guest: permit with private link, deposit charged, daily cap enforced
let r = await post("/voice/permit", { provider:"google", token:"tok-guest" });
assert.equal(r.status, 200); assert.equal(r.body.ok, true);
assert.match(r.body.signedUrl, /conversation_signature/);
assert.equal(r.body.secondsLeft, 40, "60 s a day minus the 20 s deposit");
assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
r = await post("/voice/used", { provider:"google", token:"tok-guest", seconds:30 });
assert.equal(r.body.secondsLeft, 10);
r = await post("/voice/used", { provider:"google", token:"tok-guest", seconds:999 });
assert.equal(r.body.secondsLeft, 0, "reports are capped at 30 s each but still count");
r = await post("/voice/permit", { provider:"google", token:"tok-guest" });
assert.equal(r.body.ok, false); assert.equal(r.body.reason, "day");
// tokens are never stored, only hashes
for(const [k, v0] of env.ONIX_KV.m){ const v = String(v0); assert.ok(!k.includes("tok-") && !v.includes("tok-") && !v.includes("douglas@"), "no tokens or emails in KV"); }

// Admin: no cap
for(let i = 0; i < 5; i++) r = await post("/voice/permit", { provider:"google", token:"tok-admin" });
assert.equal(r.body.ok, true); assert.equal(r.body.secondsLeft, -1); assert.equal(r.body.admin, true);

// Monthly guest pool
env.GUEST_MONTH_SECONDS = "50";
const other = "tok-other"; people[other] = { email:"ana@gmail.com", given_name:"Ana", email_verified:true };
r = await post("/voice/permit", { provider:"google", token:other });
assert.equal(r.body.ok, false); assert.equal(r.body.reason, "month", "guests share a monthly pool");
delete env.GUEST_MONTH_SECONDS;

// Free AI: plain answer, and web search flow
r = await post("/ask", { provider:"google", token:"tok-guest", messages:[{ role:"user", content:"hi" }], context:"Unread: 3" });
assert.equal(r.body.reply, "Sure. Done pretending."); assert.equal(r.body.engine, "workers-ai");
assert.match(aiCalls.at(-1)[0].content, /CONTEXT[\s\S]*Unread: 3/);
r = await post("/ask", { provider:"google", token:"tok-guest", messages:[{ role:"user", content:"When is the permit office open?" }] });
assert.match(r.body.reply, /miamidade\.gov/); assert.equal(r.body.sources[0].url, "https://www.miamidade.gov/permits");
assert.doesNotMatch(r.body.sources[0].snippet, /<b>/);

// Backup AI never receives the personal context
env.AI = { async run(){ throw new Error("quota"); } }; env.GEMINI_API_KEY = "g";
r = await post("/ask", { provider:"google", token:"tok-guest", messages:[{ role:"user", content:"hi" }], context:"SECRET-INBOX-LINE" });
assert.equal(r.body.engine, "gemini");
const g = calls.filter(c => c.url.includes("generativelanguage")).at(-1);
assert.doesNotMatch(g.opts.body, /SECRET-INBOX-LINE/);
assert.doesNotMatch(g.url, /key=/, "API key goes in a header, not the URL");

console.log("✓ ÓNIX worker: one cached ElevenLabs voice everywhere, origin lock, identity, private voice link, guest day/month caps, admin, free AI + web search, backup without personal data");
