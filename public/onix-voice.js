/* ÓNIX voice: one voice everywhere. Every line ÓNIX says outside a live conversation (welcome, brief,
   typed answers) is spoken with the same ElevenLabs voice as the agent, through the ÓNIX server.
   - Fixed lines are generated once and kept by the server, so they cost nothing after the first time.
   - Without the server (or if it fails), the phone's own voice fills in, so ÓNIX never goes silent.
   say(text, show) plays the audio and calls show(text, rate) so the subtitles finish with the voice. */
(function (scope) {
  "use strict";
  const A = () => scope.OnixAccounts;
  const base = () => String(scope.ONIX_CONFIG?.worker?.url || "").replace(/\/+$/, "");
  const ready = () => /^https:\/\//.test(base());
  const muted = () => { try { return scope.localStorage.getItem("una.onix.mute") === "1"; } catch { return false; } };
  const audio = typeof scope.Audio === "function" ? new scope.Audio() : null;
  if(audio){ audio.preload = "auto"; audio.setAttribute?.("playsinline", ""); }
  // A real 50 ms silent WAV, built here, to unlock audio inside the first tap.
  const SILENT = (() => { const n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => [...t].forEach((c, k) => b[o + k] = c.charCodeAt(0));
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
    return "data:audio/wav;base64," + scope.btoa(String.fromCharCode(...b)); })();
  // iPhones only play sound after a touch. Call this inside the first tap.
  let unlocked = false;
  function unlock(){
    if(unlocked) return;
    try { if(audio){ audio.src = SILENT; unlocked = true; audio.play().catch(() => { unlocked = false; }); } } catch { unlocked = false; }
    try { const u = new scope.SpeechSynthesisUtterance(" "); u.volume = 0; scope.speechSynthesis.speak(u); } catch {}
  }
  // How long the subtitles take at rate 1 (same timing as the engine), so they can match the audio.
  function subtitleMs(text){
    return String(text).split(" ").reduce((t, w) => t + 85 + w.length*44 + (/,$/.test(w) ? 150 : /[.?!:]$/.test(w) ? 280 : 0), 0);
  }
  const cache = new Map();
  const pending = new Map();
  async function fetchAudio(text){
    if(cache.has(text)) return cache.get(text);
    if(pending.has(text)) return pending.get(text);
    const task = (async () => {
      const id = A()?.idToken?.();
      const r = await scope.fetch(base() + "/tts", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ text, ...(id || {}) }) });
      if(!r.ok || !/audio/.test(r.headers.get("Content-Type") || "")) {
        const error = new Error("tts " + r.status); error.status = r.status; throw error;
      }
      const url = URL.createObjectURL(await r.blob());
      if(cache.size > 40){ const [k, v] = cache.entries().next().value; URL.revokeObjectURL(v); cache.delete(k); }
      cache.set(text, url); return url;
    })();
    pending.set(text, task);
    try { return await task; } finally { pending.delete(text); }
  }
  // Ask for the next lines early so they start without a pause.
  function prefetch(lines){ if(!ready() || muted() || Date.now() < retryAfter) return; lines.forEach(t => fetchAudio(t).catch(markUnavailable)); }

  function phone(text){
    return new Promise(resolve => {
      const synth = scope.speechSynthesis;
      if(muted() || !synth || typeof scope.SpeechSynthesisUtterance !== "function") return resolve();
      const u = new scope.SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 1.08;
      const vs = synth.getVoices?.() || [], en = vs.filter(v => /^en(-|_)US/i.test(v.lang));
      const v = en.find(x => /Ava|Samantha|Allison|Zoe|Evan|Nathan/i.test(x.name)) || en[0]; if(v) u.voice = v;
      const done = () => { clearTimeout(t); resolve(); }, t = setTimeout(done, 4000 + text.length*90);
      u.onend = done; u.onerror = done; try { synth.cancel(); synth.speak(u); } catch { done(); }
    });
  }
  let current = 0;
  // If ElevenLabs exhausts its credits or rate limit, stay on the browser voice
  // for this session; transient outages are retried after a short pause.
  let retryAfter = 0;
  function markUnavailable(error){
    const quota = [402, 429].includes(error?.status);
    retryAfter = Math.max(retryAfter, Date.now() + (quota ? 60*60*1000 : 30*1000));
  }
  async function say(text, show){
    const t = String(text || "").trim(); if(!t) return;
    const my = ++current;
    if(muted()){ await show?.(t, 1); return; }
    if(ready() && audio && Date.now() >= retryAfter){
      try {
        const url = await fetchAudio(t);
        if(my !== current) return;
        audio.src = url; audio.playbackRate = Number(scope.ONIX_CONFIG?.voice?.rate) || 1;
        await new Promise((res, rej) => { audio.onloadedmetadata = res; audio.onerror = rej; audio.load(); setTimeout(res, 1500); });
        const dur = (audio.duration && isFinite(audio.duration) ? audio.duration/audio.playbackRate : t.length/14)*1000;
        const ended = new Promise(res => { audio.onended = res; audio.onerror = res; setTimeout(res, dur + 1500); });
        await audio.play();
        await Promise.all([show?.(t, Math.max(.6, subtitleMs(t)/(dur*.96))), ended]);
        return;
      } catch(error){ if(my !== current) return; markUnavailable(error); }
    }
    if(my !== current) return;
    await Promise.all([show?.(t, 1), phone(t)]);
  }
  function stop(){ current++; try { audio?.pause(); } catch {} try { scope.speechSynthesis?.cancel(); } catch {} }
  function setMuted(m){ try { scope.localStorage.setItem("una.onix.mute", m ? "1" : "0"); } catch {} if(m) stop(); }

  scope.OnixVoice = Object.freeze({ say, stop, unlock, prefetch, setMuted, muted, ready, subtitleMs });
})(globalThis);
