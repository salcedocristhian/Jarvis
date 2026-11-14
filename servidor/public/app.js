/* Una — cliente. Sin dependencias. */
(() => {
"use strict";
const C = window.UNA_CONFIG || { name: "Una", owner: "", lang: "es-US", silenceMs: 1100, greet: true };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sysReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- ajustes (persisten en este dispositivo) ---------------- */
const store = {
  get(k, d) { try { return localStorage.getItem("una." + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("una." + k, v); } catch {} },
};
const prefs = {
  voice: store.get("voice", "eleven"),
  lang: store.get("lang", C.lang || "es-US"),
  motion: store.get("motion", sysReduced ? "calm" : "full"),
  pass: store.get("pass", ""),
};
const calm = () => prefs.motion === "calm";

/* ---------------- estado ---------------- */
let status = {}, demo = /[?&]demo\b/.test(location.search), projects = [];
const history = [];        // {role, content}
const timeline = [];       // {q, a}
let phase = "idle";        // idle | listening | thinking | speaking
let energy = .12, energyTarget = .12;

const stateEl = $("#state"), heardEl = $("#heard");
const LABELS = {
  es: { idle: "Toca para hablar", listening: "Te escucho", thinking: "Pensando", speaking: "Hablando", tap: "Toca para responder" },
  en: { idle: "Tap to talk", listening: "Listening", thinking: "Thinking", speaking: "Speaking", tap: "Tap to reply" },
};
const L = () => LABELS[prefs.lang.startsWith("en") ? "en" : "es"];
function setPhase(p, label) {
  phase = p;
  energyTarget = { idle: .12, listening: .5, thinking: .35, speaking: .8 }[p] ?? .12;
  stateEl.textContent = label || L()[p] || "";
}

/* ---------------- API ---------------- */
async function api(path, body) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(prefs.pass ? { "x-una-passcode": prefs.pass } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) throw Object.assign(new Error("Pon tu código de acceso en Ajustes."), { code: "auth" });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || `Error ${r.status}`), { code: j.code }); }
  return r.headers.get("content-type")?.includes("audio") ? r.blob() : r.json();
}

/* ---------------- fondo: terreno de malla ---------------- */
const bg = $("#bg"), bx = bg.getContext("2d");
const oc = $("#orbCanvas"), ox = oc.getContext("2d");
let DPR = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  bg.width = innerWidth * DPR; bg.height = innerHeight * DPR; bx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const r = oc.getBoundingClientRect(); oc.width = r.width * DPR; oc.height = r.height * DPR; ox.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener("resize", resize);
new ResizeObserver(resize).observe($("#orb"));
const wave = (x, y, t) => Math.sin(x * 1.3 + t) * .5 + Math.sin(y * 1.7 - t * .8) * .35 + Math.sin((x + y) * .9 + t * .6) * .25;
function drawBg(t) {
  const W = innerWidth, H = innerHeight;
  bx.clearRect(0, 0, W, H);
  const g = bx.createRadialGradient(W / 2, H * .34, 0, W / 2, H * .34, Math.max(W, H) * .75);
  g.addColorStop(0, `rgba(40,92,150,${.28 + energy * .15})`); g.addColorStop(.55, "rgba(10,26,48,.2)"); g.addColorStop(1, "rgba(4,7,12,0)");
  bx.fillStyle = g; bx.fillRect(0, 0, W, H);
  const rows = 22, cols = 28, horizon = H * .5, amp = 12 + energy * 40;
  const P = (u, z) => { const y0 = horizon + Math.pow(z, 1.8) * (H - horizon + 80), sp = .35 + z * 1.7; return [W / 2 + (u - .5) * W * sp, y0 - wave(u * 6, z * 5, t) * amp * (.3 + z)]; };
  bx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    const z = r / (rows - 1); bx.strokeStyle = `rgba(63,125,181,${.05 + z * .3})`; bx.beginPath();
    for (let c = 0; c <= cols; c++) { const [x, y] = P(c / cols, z); c ? bx.lineTo(x, y) : bx.moveTo(x, y); } bx.stroke();
  }
  for (let c = 0; c <= cols; c += 2) {
    bx.strokeStyle = "rgba(63,125,181,.1)"; bx.beginPath();
    for (let r = 0; r < rows; r++) { const [x, y] = P(c / cols, r / (rows - 1)); r ? bx.lineTo(x, y) : bx.moveTo(x, y); } bx.stroke();
  }
}

/* ---------------- orbe + satélites (proyectos) ---------------- */
let sats = [];             // posiciones en pantalla para tocar
function drawOrb(t) {
  const W = oc.width / DPR, H = oc.height / DPR; if (!W) return;
  ox.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = W * .3;
  const glow = ox.createRadialGradient(cx, cy, R * .1, cx, cy, R * 1.6);
  glow.addColorStop(0, `rgba(147,208,240,${.1 + energy * .14})`); glow.addColorStop(1, "rgba(147,208,240,0)");
  ox.fillStyle = glow; ox.beginPath(); ox.arc(cx, cy, R * 1.6, 0, 7); ox.fill();
  const ticks = W > 200 ? 132 : 72;
  for (let i = 0; i < ticks; i++) {
    const a = i / ticks * Math.PI * 2, k = (Math.sin(a * 5 + t * 2.2) + 1) / 2 * energy;
    const r1 = R * 1.3, r2 = r1 + 2 + k * R * .14;
    ox.strokeStyle = `rgba(147,208,240,${.14 + k * .55})`; ox.lineWidth = 1;
    ox.beginPath(); ox.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ox.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ox.stroke();
  }
  for (let k = 0; k < 3; k++) {
    ox.strokeStyle = k ? `rgba(147,208,240,${.24 - k * .06})` : "rgba(147,208,240,.92)";
    ox.lineWidth = k ? 1 : 1.7; ox.beginPath();
    for (let i = 0; i <= 180; i++) {
      const a = i / 180 * Math.PI * 2;
      const d = 1 + energy * .1 * (Math.sin(a * 3 + t * 1.7 + k) + Math.sin(a * 5 - t * 1.2 + k * 2) * .6) + .014 * Math.sin(a * 2 + t);
      const rr = R * (1 - k * .12) * d; i ? ox.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ox.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ox.closePath(); ox.stroke();
  }
  // nombre en el centro
  ox.fillStyle = "rgba(230,240,247,.92)"; ox.textAlign = "center"; ox.textBaseline = "middle";
  ox.font = `700 ${Math.max(11, R * .2)}px Unbounded, Arial Black, sans-serif`;
  if (ox.letterSpacing !== undefined) ox.letterSpacing = `${R * .03}px`;
  ox.fillText(C.name.toUpperCase(), cx, cy);
  // satélites: cada proyecto fijo; dorado = algo pendiente
  const box = oc.getBoundingClientRect(); sats = [];
  const list = projects.length ? projects : [{ ghost: true }, { ghost: true }, { ghost: true }];
  list.forEach((p, i) => {
    const dir = i % 2 ? 1 : -1, a = t * (.16 + i * .03) * dir + i * 2.1, rr = R * (1.12 + (i % 3) * .07);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, hot = p.urgent;
    const size = p.ghost ? 1.6 : hot ? 4.2 : 3;
    if (hot) { ox.fillStyle = `rgba(201,163,92,${.18 + .12 * Math.sin(t * 2)})`; ox.beginPath(); ox.arc(x, y, size * 3, 0, 7); ox.fill(); }
    ox.fillStyle = p.ghost ? "rgba(230,240,247,.6)" : hot ? "#C9A35C" : "rgba(230,240,247,.9)";
    ox.beginPath(); ox.arc(x, y, size, 0, 7); ox.fill();
    if (!p.ghost) sats.push({ p, x: box.left + x, y: box.top + y });
  });
}
let last = 0;
function loop(ms) {
  const t = ms / 1000;
  energy += (energyTarget - energy) * .06;
  if (!calm() || ms - last > 120) { drawBg(t * (calm() ? .08 : .35)); drawOrb(calm() ? t * .25 : t); last = ms; }
  requestAnimationFrame(loop);
}
resize(); requestAnimationFrame(loop);

/* ---------------- piezas que salen del orbe mientras trabaja ---------------- */
let shardTimer = null;
function shardsOn() {
  if (calm() || shardTimer) return;
  shardTimer = setInterval(() => {
    const o = $("#orb").getBoundingClientRect(), s = document.createElement("i");
    s.className = "shard"; document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2, r0 = o.width * .32, r1 = o.width * (.7 + Math.random() * .5);
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2;
    s.animate([
      { transform: `translate(${cx + Math.cos(a) * r0}px,${cy + Math.sin(a) * r0}px) rotate(0deg)`, opacity: .9 },
      { transform: `translate(${cx + Math.cos(a) * r1}px,${cy + Math.sin(a) * r1 + 40}px) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 },
    ], { duration: 1400 + Math.random() * 600, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => s.remove();
  }, 90);
}
function shardsOff() { clearInterval(shardTimer); shardTimer = null; }

/* ---------------- voz: salida ---------------- */
const audio = new Audio(); audio.preload = "auto";
let audioUnlocked = false;
function unlockAudio() {          // iOS: hay que tocar play() dentro de un toque
  if (audioUnlocked) return; audioUnlocked = true;
  audio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
  audio.play().catch(() => {});
  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch {}
}
const synth = window.speechSynthesis || null;
function pickVoice(lang) {
  const vs = synth?.getVoices() || [], pre = lang.slice(0, 2);
  const m = vs.filter(v => v.lang?.toLowerCase().startsWith(pre));
  return m.find(v => /google|natural|premium|enhanced|paulina|mónica|monica|jorge|sabina|samantha/i.test(v.name)) || m[0] || null;
}
synth?.getVoices(); if (synth) synth.onvoiceschanged = () => synth.getVoices();
let speakTick = null, stopSpeaking = () => {};
async function say(text) {
  if (!text || prefs.voice === "off") return;
  const plain = text.replace(/\*\*/g, "").replace(/https?:\S+/g, "").slice(0, 2400);
  setPhase("speaking");
  speakTick = setInterval(() => { energyTarget = .5 + Math.random() * .5; }, 110);
  try {
    if (prefs.voice === "eleven" && status.elevenlabs === "connected") {
      const blob = await api("/api/tts", { text: plain });
      const url = URL.createObjectURL(blob);
      await new Promise(res => {
        audio.src = url; audio.onended = audio.onerror = res;
        stopSpeaking = () => { audio.pause(); res(); };
        audio.play().catch(res);
      });
      URL.revokeObjectURL(url);
    } else if (synth) {
      synth.cancel();
      const voice = pickVoice(prefs.lang), parts = plain.match(/[^.!?¿¡\n]+[.!?]*/g) || [plain];
      await new Promise(res => {
        let i = 0, stopped = false;
        stopSpeaking = () => { stopped = true; synth.cancel(); res(); };
        const next = () => {
          if (stopped || i >= parts.length) return res();
          const u = new SpeechSynthesisUtterance(parts[i++].trim());
          if (voice) u.voice = voice; u.lang = voice?.lang || prefs.lang; u.rate = 0.97;
          let done = false; const go = () => { if (!done) { done = true; clearTimeout(g); next(); } };
          const g = setTimeout(go, 2500 + u.text.length * 95);
          u.onend = go; u.onerror = go; synth.speak(u);
        };
        next();
      });
    }
  } catch (e) { console.warn("voz:", e.message); }
  clearInterval(speakTick); speakTick = null; stopSpeaking = () => {};
}

/* ---------------- voz: entrada (Web Speech API) ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, talking = false, finalText = "";
function listen() {
  if (!SR) { openTyper(); stateEl.textContent = prefs.lang.startsWith("en") ? "This browser can't hear. Type instead." : "Este navegador no puede escucharte. Escríbeme."; return; }
  finalText = ""; heardEl.textContent = "";
  rec = new SR(); rec.lang = prefs.lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onresult = e => {
    let interim = ""; finalText = "";
    for (const r of e.results) (r.isFinal ? (finalText += r[0].transcript) : (interim += r[0].transcript));
    heardEl.textContent = (finalText + " " + interim).trim(); energyTarget = .75;
  };
  rec.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { talking = false; setPhase("idle", prefs.lang.startsWith("en") ? "Microphone blocked. Allow it in your browser." : "Micrófono bloqueado. Permítelo en el navegador."); }
  };
  rec.onend = () => {
    rec = null;
    const said = finalText.trim() || heardEl.textContent.trim();
    if (!talking) return;
    if (said) return turn(said);
    setPhase("idle", L().tap); talking = false;          // silencio: espera otro toque
  };
  try { rec.start(); setPhase("listening"); }
  catch { setPhase("idle", L().tap); talking = false; }
}
function stopListening() { try { rec?.abort(); } catch {} rec = null; }

/* ---------------- una vuelta de conversación ---------------- */
const BYE = /^(adiós|adios|chao|gracias,? eso es todo|eso es todo|bye|that'?s all)[.!]*$/i;
async function turn(q) {
  heardEl.textContent = q;
  if (BYE.test(q)) { await say(prefs.lang.startsWith("en") ? "Anytime." : "Aquí estoy cuando me necesites."); return endTalk(); }
  setPhase("thinking"); shardsOn();
  history.push({ role: "user", content: q });
  let out;
  try {
    out = demo ? await demoAnswer(q) : await api("/api/ask", { messages: history, lang: prefs.lang, owner: C.owner, name: C.name });
  } catch (e) {
    out = { speech: e.message, frames: [{ type: "headline", text: e.code === "not_connected" ? "Falta conectar Claude." : "No pude responder." }, { type: "evidence", title: e.message, detail: "", source: "Servidor local" }], closer: "" };
    history.pop();
  }
  shardsOff();
  if (out.speech && history.at(-1)?.role === "user") history.push({ role: "assistant", content: out.speech });
  timeline.unshift({ q, a: out.speech }); renderHistory();
  const play = showReel(out);
  await Promise.all([say(out.speech), play.minTime]);
  play.finish();
  if (talking) listen(); else setPhase("idle");
}
function startTalk() {
  unlockAudio(); talking = true; document.body.classList.add("talking");
  if (C.greet && !startTalk.done) {
    startTalk.done = true;
    const h = new Date().getHours(), en = prefs.lang.startsWith("en");
    const g = en ? (h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening") : (h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches");
    const line = `${g}${C.owner ? ", " + C.owner : ""}. ${en ? "What do you need?" : "¿En qué te ayudo?"}`;
    heardEl.textContent = line;
    // el reconocimiento arranca dentro del toque en navegadores estrictos; si la voz está en silencio, escucha ya
    if (prefs.voice === "off") return listen();
    say(line).then(() => talking && listen());
    return;
  }
  listen();
}
function endTalk() {
  talking = false; stopListening(); stopSpeaking(); shardsOff();
  document.body.classList.remove("talking"); setPhase("idle");
}

/* ---------------- el reel: respuestas como cuadros animados ---------------- */
const reel = $("#reel"), framesEl = $("#frames"), ticksEl = $("#ticks"), closerEl = $("#closer");
let reelTimer = null, reelIdx = 0, reelFrames = [];
function money(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
function odometer(str) {
  return `<div class="odo" aria-label="${esc(str)}">` + [...str].map(ch => /\d/.test(ch)
    ? `<span class="col"><span class="strip" data-d="${ch}">${"0123456789".split("").map(n => `<span>${n}</span>`).join("")}</span></span>`
    : `<span class="fixed">${esc(ch)}</span>`).join("") + `</div>`;
}
function frameHTML(f) {
  switch (f.type) {
    case "number": {
      const v = Number(f.value) || 0, s = f.format === "usd" ? money(v) : Math.round(v).toLocaleString("en-US");
      return `<div class="frame f-number">${odometer(s)}<p>${esc(f.label || "")}</p></div>`;
    }

    case "insight": {
      const safe = typeof f.link === "string" && /^https:\/\/github\.com\/salcedocristhian\/[\w.-]+/.test(f.link) ? f.link : "";
      return '<div class="frame f-insight"><article class="insight-card"><small class="insight-tag">'+esc(f.tag || "FUENTE GITHUB")+'</small><p class="insight-title">'+esc(f.title||"")+'</p><strong class="insight-value">'+esc(f.value||"")+'</strong><p class="insight-note">'+esc(f.note||"")+'</p>'+(safe?'<a class="source-link" href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">Ver fuente original ↗</a>':"")+'</article></div>';
    }
    case "source": {
      const safe = typeof f.link === "string" && /^https:\/\/github\.com\/salcedocristhian\/[\w.-]+/.test(f.link) ? f.link : "";
      return '<div class="frame f-insight"><article class="insight-card"><small class="insight-tag">DOCUMENTO ORIGINAL</small><p class="insight-title">'+esc(f.title||"")+'</p><p class="insight-note">'+esc(f.note||"")+'</p>'+(safe?'<a class="source-link" href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">Abrir GitHub ↗</a>':"")+'</article></div>';
    }
    case "capability":
      return '<div class="frame f-insight"><article class="insight-card future-card"><small class="insight-tag">'+esc(f.tag||"VISIÓN FUTURA · NO CONECTADA")+'</small><p class="insight-title">'+esc(f.title||"")+'</p><p class="insight-note">'+esc(f.note||"")+'</p></article></div>';
    case "evidence":
      return `<div class="frame f-evidence"><div class="card"><b>${esc(f.title)}</b>${f.detail ? `<p>${esc(f.detail)}</p>` : ""}<small>${esc(f.source || "")}</small></div></div>`;
    case "action":
      return `<div class="frame f-action"><div class="mark"></div><h3>${esc(f.text)}</h3></div>`;
    default:
      return `<div class="frame f-headline"><h3>${esc(f.text || "").split(" ").map((w, i) => `<span class="w" style="transition-delay:${i * 70}ms">${w}</span>`).join(" ")}</h3></div>`;
  }
}
function go(i) {
  const els = framesEl.children; if (!els.length) return;
  reelIdx = Math.max(0, Math.min(els.length - 1, i));
  [...els].forEach((el, k) => { el.classList.toggle("on", k === reelIdx); el.classList.toggle("past", k < reelIdx); });
  [...ticksEl.children].forEach((t, k) => t.classList.toggle("on", k === reelIdx));
  const cur = els[reelIdx];
  cur.querySelectorAll(".strip").forEach((s, k) => {
    s.style.transitionDelay = `${k * 90}ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = `translateY(-${s.dataset.d}em)`; }));
  });
}
function showReel(out) {
  clearTimeout(reelTimer);
  reelFrames = (out.frames && out.frames.length ? out.frames : [{ type: "headline", text: out.speech }]).slice(0, 6);
  framesEl.innerHTML = reelFrames.map(frameHTML).join("");
  ticksEl.innerHTML = reelFrames.length > 1 ? reelFrames.map(() => "<i></i>").join("") : "";
  closerEl.textContent = out.closer || ""; closerEl.classList.remove("on");
  reel.classList.remove("absorb"); reel.hidden = false;
  document.body.classList.add("docked");
  const speechMs = Math.max(2400, (out.speech || "").length * 62);
  const per = Math.max(2300, speechMs / reelFrames.length);
  let auto = true;
  const step = k => { go(k); if (auto && k < reelFrames.length - 1) reelTimer = setTimeout(() => step(k + 1), per); };
  requestAnimationFrame(() => step(0));
  framesEl.onclick = e => {
    if (e.target.closest("a,button")) return;
    auto = false; clearTimeout(reelTimer);
    const r = framesEl.getBoundingClientRect();
    go(reelIdx + (e.clientX > r.left + r.width / 2 ? 1 : -1));
  };
  return {
    minTime: new Promise(res => setTimeout(res, Math.min(per * reelFrames.length, 12000))),
    finish() { clearTimeout(reelTimer); go(reelFrames.length - 1); if (out.closer) closerEl.classList.add("on"); },
  };
}
function clearReel() {
  if (reel.hidden) return;
  clearTimeout(reelTimer);
  reel.classList.add("absorb");
  energyTarget = .9; setTimeout(() => { if (phase === "idle") energyTarget = .12; }, 500);
  setTimeout(() => { reel.hidden = true; reel.classList.remove("absorb"); framesEl.innerHTML = ""; heardEl.textContent = ""; document.body.classList.remove("docked"); }, calm() ? 10 : 650);
}

/* ---------------- gestos ---------------- */
const orb = $("#orb");
let pressT = null, longPressed = false;
orb.addEventListener("pointerdown", () => { longPressed = false; pressT = setTimeout(() => { longPressed = true; openTyper(); }, 550); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev => orb.addEventListener(ev, () => clearTimeout(pressT)));
orb.addEventListener("contextmenu", e => e.preventDefault());
orb.addEventListener("click", e => {
  if (longPressed) return;
  const hit = sats.find(s => Math.hypot(s.x - e.clientX, s.y - e.clientY) < 24);
  if (hit) return askAbout(hit.p);
  if (phase === "speaking") { stopSpeaking(); return; }       // tocar mientras habla = interrumpir
  if (talking) return endTalk();
  if (!reel.hidden) clearReel();
  startTalk();
});
function askAbout(p) {
  unlockAudio(); stopListening(); stopSpeaking();
  const q = prefs.lang.startsWith("en") ? `How is ${p.label} going?` : `¿Cómo va ${p.label}?`;
  turn(q);
}
let touchY = null;
document.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
document.addEventListener("touchend", e => {
  if (touchY == null || document.querySelector("dialog[open]")) return;
  const dy = e.changedTouches[0].clientY - touchY; touchY = null;
  if (dy > 90) { closeTyper(); clearReel(); }
  else if (dy < -90 && !$("#typer").contains(e.target)) openSheet("menu");
}, { passive: true });
addEventListener("keydown", e => {
  if (e.key === "Escape") { if (talking) endTalk(); clearReel(); closeTyper(); }
  if (e.key === " " && e.target === document.body) { e.preventDefault(); orb.click(); }
  if (!reel.hidden && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { clearTimeout(reelTimer); go(reelIdx + (e.key === "ArrowRight" ? 1 : -1)); }
});

/* ---------------- escribir (mantener presionado) ---------------- */
function openTyper() { $("#typer").hidden = false; $("#typeIn").focus(); }
function closeTyper() { $("#typer").hidden = true; }
$("#typer").addEventListener("submit", e => {
  e.preventDefault(); const q = $("#typeIn").value.trim(); if (!q) return;
  $("#typeIn").value = ""; closeTyper(); unlockAudio(); stopListening(); turn(q);
});

/* ---------------- hojas: menú y ajustes ---------------- */
function openSheet(id) { const d = $("#" + id); if (!d.open) d.showModal(); }
$("#menuBtn").addEventListener("click", () => openSheet("menu"));
$("#setBtn").addEventListener("click", () => openSheet("settings"));
document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));
function renderProjects() {
  $("#projList").innerHTML = projects.length ? projects.map(p => `<button type="button" data-id="${esc(p.id)}"><span><b>${esc(p.label)}</b><small>${p.error ? esc(p.error) : (p.demoDetail ? esc(p.demoDetail) : (p.openTasks == null ? `${esc(p.number || "Sin número")} · ${esc(p.status || "Estado no indicado")}` : `${esc(p.number || "")} · ${p.openTasks} tareas abiertas · ${p.pendingDocs ?? "?"} documentos pendientes`))}</small></span><i class="dot ${p.urgent ? "hot" : ""}"></i></button>`).join("")
    : `<p class="muted small">Agrega PINNED_JOBS en tu .env para ver tus proyectos aquí y como satélites del orbe.</p>`;
}
$("#projList").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (!b) return; $("#menu").close(); askAbout(projects.find(p => p.id === b.dataset.id)); });
function renderHistory() {
  $("#hist").innerHTML = timeline.length ? timeline.slice(0, 20).map(t => `<p class="q">${esc(t.q)}</p><p class="a">${esc(t.a)}</p>`).join("") : `<p class="muted">Todavía no han hablado.</p>`;
}
function renderConns() {
  const names = { claude: "Claude", jobtread: "JobTread", elevenlabs: "ElevenLabs", outlook: "Outlook" };
  $("#conns").innerHTML = Object.entries(names).map(([k, n]) => {
    const s = demo ? "demo" : status[k] || "not_connected";
    return `<li><span>${n}</span><span class="${s === "connected" ? "ok" : "no"}">${{ connected: "Conectado", not_connected: "Sin conectar", demo: "Demo" }[s] || s}</span></li>`;
  }).join("");
}
const bind = (id, key, after) => { const el = $(id); el.value = prefs[key]; el.addEventListener("change", () => { prefs[key] = el.value; store.set(key, el.value); after?.(); }); };
bind("#optVoice", "voice"); bind("#optLang", "lang", () => setPhase(phase)); bind("#optMotion", "motion"); bind("#optPass", "pass", boot);

/* --- DEMO REAL: READ-ONLY GITHUB DATA. No secret keys or invented financial data. --- */
const DEMO_PROJECTS = [
  {
    "id": "repo-5660",
    "label": "5660 Collins",
    "number": "GitHub · Permits",
    "demoDetail": "Permisos · Schedule · Planos",
    "urgent": false
  },
  {
    "id": "repo-barcelona",
    "label": "Barcelona Gardens",
    "number": "GitHub · Restoration",
    "demoDetail": "Elevaciones · Repairs · Fotos",
    "urgent": false
  },
  {
    "id": "repo-gorilla",
    "label": "Gorilla Screens",
    "number": "GitHub · V17 Beta",
    "demoDetail": "Enclosures · 3D · Takeoff",
    "urgent": false
  },
  {
    "id": "repo-kingfisher",
    "label": "19984 Kingfisher",
    "number": "GitHub · Studio 2.2",
    "demoDetail": "3D · Diseño · Build",
    "urgent": false
  },
  {
    "id": "repo-ocean",
    "label": "Ocean Park Manor",
    "number": "Pendiente",
    "demoDetail": "Repositorio no localizado",
    "urgent": false
  }
];
async function demoRead(repo, file, asJSON=false) {
  const allowed={"5660-collins-app":["data/permits.json"],"Barcelona":["README.md"],"Gorilla-Screens":["README.md"],"19984-Kingfisher-Lane-App":["README.md"]};
  if (!(allowed[repo]||[]).includes(file)) return null;
  try {
    const r=await fetch("https://raw.githubusercontent.com/salcedocristhian/"+repo+"/main/"+file,{cache:"no-store"});
    if (!r.ok) return null;
    return asJSON?await r.json():await r.text();
  } catch {return null;}
}
async function demoAnswer(q) {
  const z=String(q||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const base="https://github.com/salcedocristhian/";
  const source=(title,note,link)=>({type:"source",title,note,link});
  const info=(title,value,note,link,tag="FUENTE GITHUB")=>({type:"insight",title,value,note,link,tag});
  const future=(title,note)=>({type:"capability",title,note,tag:"CAPACIDAD FUTURA · NO CONECTADA"});
  const to=(speech,frames,project=null)=>({speech,frames,project,closer:"Fuentes primero. Decisiones después.",sources:["GitHub"]});
  if (/5660|collins|permiso|pasillo|garaje|garage|fire watch/.test(z)) {
    const d=await demoRead("5660-collins-app","data/permits.json",true);
    const a=d?.items?.find(x=>x.id==="corridor");
    const g=d?.items?.find(x=>x.id==="garage");
    const fresh=d?.updatedAt ? "Actualizado en archivo: "+d.updatedAt : "Snapshot de referencia: 2026-11-07 · no leído en vivo";
    const link=base+"5660-collins-app/blob/main/data/permits.json";
    return to(
      "En el registro del proyecto 5660, el permiso de pasillos figura emitido el 6 de noviembre. El garaje sigue en coordinación administrativa. Esta información viene del repositorio, no de una consulta en vivo a la ciudad.",
      [{type:"headline",text:"5660 Collins. Expediente verificable."},
       info("Remediación de pasillos","BC2628687",a?.status||"Emitido el 6 de noviembre de 2026",link,"REGISTRO DE PERMISOS"),
       info("Garaje / Stormwater","BC2526722",g?.status||"Scope revisado · aprobación no confirmada",link),
       info("Próximo control","17 NOV · 9:00 AM","Audiencia de iluminación. Confirmar comparecencia; 26 nov., seguimiento administrativo del garaje.",link,"FECHAS POR RECONFIRMAR"),
       source("Abrir registro original",fresh,link)],"repo-5660");
  }
  if (/barcelona|balcon|elevacion|repair|reparacion|nv5|companycam/.test(z)) {
    const readme=await demoRead("Barcelona","README.md");
    const link=base+"Barcelona/blob/main/README.md";
    const found=!!readme;
    return to("Barcelona Gardens ya contiene datos de reparaciones, elevaciones y fotografías. El registro del Building 100 identifica cuarenta y nueve fotografías y treinta y tres reparaciones posicionadas aproximadamente. Puedo enseñarte de dónde sale cada dato.",
      [{type:"headline",text:"Barcelona Gardens. Evidencia de campo."},
       info("Building 100","49 FOTOS","Elevaciones CompanyCam · 11 nov. 2026",link,"INVENTARIO DEL REPO"),
       info("Reparaciones en elevaciones","33","Ubicaciones aproximadas, no levantamiento certificado",link),
       info("Balcones","35 FOTOS","Log de balcones · 20–21 oct. 2026",link),
       source("Abrir Barcelona",found?"README leído de GitHub en esta consulta":"Snapshot del README verificado anteriormente · conexión temporalmente no disponible",link)],"repo-barcelona");
  }
  if (/gorilla|screen|enclosure|estructura|perfil|cotizacion|takeoff/.test(z)) {
    const readme=await demoRead("Gorilla-Screens","README.md"),link=base+"Gorilla-Screens";
    return to("Gorilla Screens tiene un Studio V17 beta para modelos conceptuales, perfiles, takeoff y planos preliminares. La visión automática desde fotografías sigue en desarrollo y requiere verificación humana.",
      [{type:"headline",text:"Gorilla Screens. Del campo al 3D."},
       info("Studio","V17 BETA","Modelo conceptual 3D, materiales y takeoff",link),
       info("Entregables","11 × 17","Láminas preliminares y RFQ con revisión humana",link),
       future("AI Vision","Una captura de fotos podría alimentar el análisis, pero el puente de IA requiere despliegue y no reemplaza medidas verificadas."),
       source("Abrir Gorilla Screens",readme?"README consultado":"Resumen del README almacenado como referencia; lectura en vivo no disponible",link)],"repo-gorilla");
  }
  if (/king|19984|fisher|casa|interior|build/.test(z)) {
    const readme=await demoRead("19984-Kingfisher-Lane-App","README.md"),link=base+"19984-Kingfisher-Lane-App";
    return to("El repositorio de Kingfisher incluye una experiencia móvil con modelo 3D, materiales, vistas y secuencia de construcción. Jarvis puede usarlo como demostración visual sin cambiar los diseños.",
      [{type:"headline",text:"Kingfisher. Un proyecto que se recorre."},
       info("Studio","2.2","Navegación Home, Design, Build y Saved",link),
       info("Recorrido","3D","Vistas de exteriores, interiores y materiales",link),
       source("Abrir código original",readme?"README consultado":"Referencia documentada en README; lectura no disponible",link)],"repo-kingfisher");
  }
  if (/ocean|park|manor/.test(z)) {
    return {speech:"Ocean Park Manor está contemplado en el diseño, pero no encontré un repositorio autorizado para sus documentos. No mostraré planos ni datos inventados.",frames:[{type:"headline",text:"Ocean Park Manor. Sin conectar."},future("Conectar proyecto","Al obtener acceso a sus archivos, Jarvis podrá mostrar evidencia técnica, PDFs y cronogramas sin crear datos ficticios.")],project:"repo-ocean",closer:"Lo que no está verificado, no se presenta como hecho.",sources:[]};
  }
  if (/correo|outlook|email|calendario|adjunto|pdf|crear|publicar|github|conexi|voz|voice|eleven/.test(z)) {
    return {speech:"Te muestro una capacidad futura. Con Outlook, JobTread, ElevenLabs y un servidor seguro, podré investigar un correo y sus adjuntos, visualizar hallazgos como tarjetas y preparar un documento. No enviaré ni publicaré nada sin tu aprobación.",frames:[{type:"headline",text:"De correo a decisión. Una sola conversación."},future("Outlook y archivos","El correo aparece como tarjeta, y un PDF se transforma en evidencias y tareas con fuentes."),future("ElevenLabs","La voz premium puede narrar cualquier respuesta cuando esté configurada la API y la voz correspondiente."),future("Aprobaciones","Vista previa del email o del cambio en GitHub, seguida de aprobación explícita." )],closer:"Las conexiones no se simulan como activas.",sources:[]};
  }
  return to("Esta demo usa registros públicos verificables de tus proyectos. Prueba preguntarme por 5660 Collins, las elevaciones de Barcelona, Gorilla Screens o Kingfisher. También puedo explicarte cómo serán las conexiones futuras.",
    [{type:"headline",text:"Tus proyectos. Una interfaz viva."},
     info("5660 Collins","BC2628687","Permiso de pasillos documentado como emitido",base+"5660-collins-app"),
     info("Barcelona Gardens","49 FOTOS","Elevaciones Building 100 del inventario",base+"Barcelona"),
     info("Gorilla Screens","V17 BETA","Diseño 3D, takeoff y entrega preliminar",base+"Gorilla-Screens"),
     future("Próxima etapa","Outlook, JobTread, CompanyCam, PDFs y acciones seguras coordinadas desde un solo orbe.")]);
}

/* ---------------- arranque ---------------- */
async function boot() {
  try {
    status = await api("/api/status");
    if (status.passcode) $("#passRow").hidden = false;
    if (status.claude !== "connected" && status.jobtread !== "connected") demo = true;
  } catch { demo = true; }
  $("#demoTag").hidden = !demo;
  renderConns();
  try { projects = demo ? DEMO_PROJECTS : await api("/api/projects"); }
  catch (e) { projects = []; if (e.code === "auth") { stateEl.textContent = e.message; openSheet("settings"); } }
  renderProjects();
}
setPhase("idle"); renderHistory(); boot();
})();
