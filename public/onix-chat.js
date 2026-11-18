/* ÓNIX server client (Cloudflare worker): voice permits, seconds used, free text AI and web search.
   Every request carries the person's current Google/Microsoft access token so the server can confirm who it is.
   Without a worker URL in onix-config.js, everything here reports "not ready" and the app works as in phase 1. */
(function (scope) {
  "use strict";
  const A = () => scope.OnixAccounts, D = () => scope.OnixData, H = () => scope.OnixHome;
  const base = () => String(scope.ONIX_CONFIG?.worker?.url || "").replace(/\/+$/, "");
  const ready = () => /^https:\/\//.test(base());
  async function post(path, body = {}){
    if(!ready()) throw new Error("The ÓNIX server isn't set up yet.");
    const id = A()?.idToken(); if(!id) throw new Error("Not connected. Tap Reconnect.");
    const r = await scope.fetch(base() + path, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ ...body, ...id }) });
    const d = await r.json().catch(() => ({}));
    if(!r.ok && !("ok" in d)) throw new Error("The ÓNIX server answered " + r.status + ".");
    if(r.status >= 400) throw new Error(d.error || "The ÓNIX server said no.");
    return d;
  }
  // What the free AI may know: a short, real summary of the person's own inbox and calendar, built on the phone.
  let ctx = { at:0, text:"" };
  async function context(){
    if(Date.now() - ctx.at < 120000) return ctx.text;
    const lines = [], when = iso => new Date(iso).toLocaleString("en-US", { weekday:"short", hour:"numeric", minute:"2-digit" });
    try { const m = await D().mail.search("unread", 5); lines.push(`Unread emails (${m.total}):`, ...m.items.map(x => `- ${x.from}: ${x.subject}`)); } catch {}
    try { const s = new Date(); s.setHours(0, 0, 0, 0); const ev = await D().cal.range(s, new Date(s.getTime() + 2*864e5));
      lines.push("Calendar today and tomorrow:", ...(ev.length ? ev.map(e => `- ${e.allDay ? "all day" : when(e.start)} ${e.title}${e.response === "needsAction" ? " (not answered)" : ""}`) : ["- nothing"])); } catch {}
    lines.push(`Now: ${new Date().toLocaleString("en-US")}`);
    ctx = { at:Date.now(), text:lines.join("\n") };
    return ctx.text;
  }
  const history = [];
  async function ask(text){
    const q = String(text || "").trim().slice(0, 1500); if(!q) return "";
    history.push({ role:"user", content:q });
    const d = await post("/ask", { messages:history.slice(-10), context:await context(), name:A()?.callName() });
    const reply = d.reply || "…";
    history.push({ role:"assistant", content:reply });
    return { reply, sources:d.sources || [] };
  }
  // Typed conversation: subtitles on the orb plus the phone's free voice.
  async function talk(text){
    H()?.heard(text); H()?.setState("thinking");
    try {
      const { reply, sources } = await ask(text);
      H()?.setState("idle");
      const said = reply + (sources?.length ? ` (${new URL(sources[0].url).hostname})` : "");
      await H()?.speak(said);
      return reply;
    } catch(e){ H()?.setState("idle"); const m = String(e.message || e); H()?.reply(m, { rate:1 }); return m; }
  }
  scope.OnixChat = Object.freeze({
    ready, talk, ask,
    permit: () => post("/voice/permit"),
    used: seconds => post("/voice/used", { seconds }),
    search: q => post("/search", { query:q }).then(d => d.results || [])
  });
})(globalThis);
