/* ÓNIX home: the orb and the mesh as the main screen.
   - Tap the orb to talk, hold it to type.
   - Answers turn into the data: a week rises from the mesh, emails and files become cards.
   - The morning brief uses the phone's free voice and only real numbers.
   - Every send or RSVP waits on screen for approval, then gives a few seconds to undo. */
(function (scope) {
  "use strict";
  const doc = scope.document;
  const A = () => scope.OnixAccounts, D = () => scope.OnixData;
  let eng = null, host = null, opts = {}, tapBtn = null, hint = null, idleTimer = 0, sayChain = Promise.resolve(), sayGen = 0, view = "orb";

  /* ---------- free voice ---------- */
  function freeVoice(text){
    return new Promise(resolve => {
      const synth = scope.speechSynthesis;
      if(!synth || typeof scope.SpeechSynthesisUtterance !== "function" || scope.localStorage?.getItem("una.onix.mute") === "1") return resolve();
      const u = new scope.SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 1.08;
      const vs = synth.getVoices?.() || [], en = vs.filter(v => /^en(-|_)US/i.test(v.lang));
      const v = en.find(x => /Ava|Samantha|Allison|Zoe|Evan|Nathan/i.test(x.name)) || en[0]; if(v) u.voice = v;
      const done = () => { clearTimeout(t); resolve(); }, t = setTimeout(done, 4000 + text.length*90);
      u.onend = done; u.onerror = done; try { synth.cancel(); synth.speak(u); } catch { done(); }
    });
  }

  /* ---------- mount ---------- */
  function mount(o = {}){
    if(host) return api;
    opts = o;
    host = doc.createElement("div"); host.className = "onx-home"; doc.body.prepend(host);
    eng = scope.OnixEngine.mount(host, { calm:doc.documentElement.dataset.motion === "calm" });
    eng.tween(k => eng.meshIn = k, 1400, eng.ease);
    tapBtn = doc.createElement("button"); tapBtn.type = "button"; tapBtn.className = "onx-orb-tap"; tapBtn.setAttribute("aria-label", "Talk to ÓNIX. Hold to type.");
    hint = doc.createElement("p"); hint.className = "onx-hint"; hint.setAttribute("aria-hidden", "true"); hint.textContent = "Tap to talk · hold to type";
    host.querySelector(".onx-ui").append(tapBtn, hint);
    place(); scope.addEventListener("resize", place);
    let pressT = 0, held = false;
    tapBtn.addEventListener("pointerdown", () => { held = false; pressT = setTimeout(() => { held = true; opts.onHold?.(); }, 550); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => tapBtn.addEventListener(ev, () => clearTimeout(pressT)));
    tapBtn.addEventListener("contextmenu", e => e.preventDefault());
    tapBtn.addEventListener("click", () => { if(held) return; skipNow?.(); if(view !== "orb") orb(); opts.onTap?.(); });
    requestAnimationFrame(loop);
    return api;
  }
  function place(){
    const W = scope.innerWidth, H = scope.innerHeight, y = Math.max(90, H*.2), s = Math.max(120, Math.min(170, W*.4));
    Object.assign(tapBtn.style, { left:(W/2 - s/2) + "px", top:(y - s/2) + "px", width:s + "px", height:s + "px" });
    hint.style.top = (y + s/2 + 2) + "px";
  }
  function loop(){
    if(!eng) return;
    const ag = scope.JarvisElevenAgent;
    if(ag?.connected && state === "speaking") eng.setVoice(Math.min(1, ag.level()*1.8));
    requestAnimationFrame(loop);
  }

  /* ---------- state from the conversation ---------- */
  let state = "idle";
  const HINT = { idle:"Tap to talk · hold to type", connecting:"Connecting…", listening:"Listening · tap to stop", speaking:"Talking · tap to stop", thinking:"Looking…" };
  function setState(s){
    if(!eng) return;
    state = s; hint.textContent = HINT[s] || ""; hint.dataset.state = s;
    eng.setMode(s === "listening" ? "listen" : "idle");
    if(s !== "speaking") eng.setVoice(0);
    if(s === "connecting" && view === "orb") eng.become("think", null, 600);
    else if((s === "listening" || s === "idle") && view === "orb") eng.become("orb", null, 700);
    if(s === "idle") scheduleIdle(12000);
  }
  function heard(text){ if(!eng || !text) return; eng.echo(String(text).slice(0, 220)); }
  // Subtitles for the agent's words. Each new reply replaces the last one.
  function reply(text, { rate = 1.35 } = {}){
    if(!eng || !text) return Promise.resolve();
    const gen = ++sayGen, t = String(text).slice(0, 600);
    sayChain = sayChain.then(async () => { if(gen !== sayGen || !eng) return; await eng.say(t, { rate }); });
    return sayChain;
  }
  function setView(v){ view = v; if(hint) hint.style.opacity = v === "orb" ? "" : "0"; }
  function scheduleIdle(ms){ clearTimeout(idleTimer); idleTimer = setTimeout(() => { if(state === "idle" || state === "listening") orb(); }, ms); }
  async function orb(){
    if(!eng) return;
    clearTimeout(idleTimer);
    const was = view; setView("orb");
    if(was === "week") eng.hideWeek(); if(was === "list") eng.hideList(); eng.hideName();
    eng.spot.k = 0;
    await eng.become(state === "connecting" ? "think" : "orb", null, 800);
  }

  /* ---------- the data takes shape ---------- */
  const shortDate = iso => { const d = new Date(iso); if(isNaN(d)) return ""; const t0 = new Date(); t0.setHours(0, 0, 0, 0); const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - t0)/864e5); return diff === 0 ? d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" }) : diff === -1 ? "Yesterday" : d.toLocaleDateString("en-US", { month:"short", day:"numeric" }); };
  const clock = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" }); };
  async function showMail(items = [], { total } = {}){
    if(!eng) return;
    if(view === "week") eng.hideWeek(); eng.hideName();
    setView("list");
    await eng.list(items.slice(0, 3).map((m, i) => ({ title:m.subject, meta:`${m.from} · ${shortDate(m.date)}${m.unread ? " · unread" : ""}`, hot:i === 0 && (m.unread || m.important) })));
    eng.kick = .3; scheduleIdle(20000);
    return total;
  }
  async function showFiles(files = []){
    if(!eng) return;
    if(view === "week") eng.hideWeek();
    setView("list");
    await eng.list(files.slice(0, 3).map(f => ({ title:f.name, meta:`${f.kind || "file"} · ${shortDate(f.modified)}` })));
    scheduleIdle(20000);
  }
  function weekOf(from){ const a = new Date(from || Date.now()); a.setHours(0, 0, 0, 0); return a; }
  // events: from OnixData.cal.range; focus: the day the person asked about.
  async function showWeek(events = [], focus){
    if(!eng) return;
    if(view === "list") eng.hideList(); if(view === "week") await eng.hideWeek();
    eng.hideName(); setView("week");
    const f = weekOf(focus), start = weekOf(); if(f < start) start.setTime(f.getTime());
    if((f - start)/864e5 > 6) start.setTime(f.getTime() - 3*864e5);
    const labels = [], counts = [];
    for(let i = 0; i < 7; i++){ const d = new Date(start.getTime() + i*864e5); labels.push(d.toLocaleDateString("en-US", { weekday:"short" }).toUpperCase() + " " + d.getDate());
      counts.push(events.filter(e => { const s = new Date(e.start); s.setHours(0, 0, 0, 0); return s.getTime() === d.getTime(); }).length); }
    eng.become("orb", null, 600);
    await eng.week({ labels, counts, hot:Math.round((f - start)/864e5) });
    scheduleIdle(22000);
  }
  async function showNumber(n, caption){ if(!eng) return; if(view === "list") eng.hideList(); setView("number"); await eng.nameplate(String(n), caption); scheduleIdle(8000); }

  /* ---------- morning brief ---------- */
  let skipNow = null;
  async function brief(){
    if(!eng || !A()?.profile()) return false;
    const p = A().provider(), id = p === "google" ? ["gmail", "gcal"] : ["outlook", "mscal"];
    if(!id.some(x => A().state(x) === "ready")) return false;
    let skipped = false; skipNow = () => { skipped = true; scope.speechSynthesis?.cancel?.(); };
    const say = t => skipped ? null : Promise.all([eng.say(t, { rate:1 }), freeVoice(t)]);
    const name = A().callName(), h = new Date().getHours();
    const hello = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
    let mail = null, events = [], invites = 0;
    try { if(A().state(id[0]) === "ready") mail = await D().mail.unread(); } catch {}
    try { if(A().state(id[1]) === "ready"){ const s = new Date(); s.setHours(0, 0, 0, 0); events = await D().cal.range(s, new Date(s.getTime() + 7*864e5)); } } catch {}
    const today = events.filter(e => new Date(e.start).toDateString() === new Date().toDateString());
    const upcoming = today.filter(e => !e.allDay && new Date(e.end || e.start) > new Date());
    invites = events.filter(e => e.response === "needsAction").length;
    let line1 = `${hello}${name ? ", " + name : ""}.`;
    if(mail){ line1 += mail.unread === 0 ? " Inbox zero. I'm genuinely concerned." : ` ${mail.unread} unread${mail.important ? `, ${mail.important} that look important` : ""}.`; }
    if(mail && mail.unread) showNumber(mail.unread, mail.important ? `${mail.important} important` : "unread");
    await say(line1);
    if(!skipped && events.length){
      showWeek(events, new Date());
      const n = upcoming.length;
      let line2 = n === 0 ? (today.length ? "Nothing left on today's calendar." : "Nothing on the calendar today. Enjoy it while it lasts.")
        : `${n} meeting${n === 1 ? "" : "s"} left today. Next: ${upcoming[0].title}${upcoming[0].allDay ? "" : " at " + clock(upcoming[0].start)}.`;
      if(invites) line2 += ` And ${invites} invite${invites === 1 ? "" : "s"} still waiting on your answer.`;
      await say(line2);
    }
    if(!skipped){ await eng.sleep(600); await say("Tap me when you need something."); }
    skipNow = null; await eng.sleep(1200);
    // Leave the screen alone if the conversation already put something else on it.
    if(view === "week" || view === "number"){ eng.clearSubs(); orb(); }
    return true;
  }

  /* ---------- approval with undo ---------- */
  // action: { kind:"reply", to, subject, text } | { kind:"rsvp", title, when, response, note }
  // run(final): performs it. Returns { status:"sent"|"cancelled"|"undone"|"failed", result?, error? }
  function confirm(action, run){
    return new Promise(resolve => {
      const prov = A().provider(), actId = prov === "google" ? "gact" : "msact";
      const box = doc.createElement("div"); box.className = "onx-sheet onx-approve"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "onxApTitle");
      const panel = doc.createElement("div"); panel.className = "onx-sheet-panel";
      const h = doc.createElement("h2"); h.id = "onxApTitle";
      const meta = doc.createElement("p"); meta.className = "onx-who";
      const status = doc.createElement("p"); status.className = "onx-sheet-status"; status.setAttribute("role", "status");
      let field = null;
      if(action.kind === "reply"){
        h.textContent = "Send this reply?"; meta.textContent = `To ${action.to || "the sender"} · ${action.subject || ""}`;
        field = doc.createElement("textarea"); field.className = "onx-draft"; field.value = action.text || ""; field.rows = 7; field.setAttribute("aria-label", "Reply text. You can edit it.");
      } else {
        const verb = { accepted:"Accept", declined:"Decline", tentative:"Maybe" }[action.response] || "Answer";
        h.textContent = `${verb} this invite?`; meta.textContent = `${action.title || "Event"}${action.when ? " · " + action.when : ""}`;
        if(action.note){ field = doc.createElement("textarea"); field.className = "onx-draft"; field.value = action.note; field.rows = 3; field.setAttribute("aria-label", "Note to the organizer"); }
      }
      const row = doc.createElement("div"); row.className = "onx-sheet-foot";
      const btn = (t, cls) => { const b = doc.createElement("button"); b.type = "button"; b.className = "onx-btn " + (cls || ""); b.textContent = t; row.append(b); return b; };
      const go = btn(action.kind === "reply" ? "Send" : "Confirm", "primary"), no = btn("Cancel");
      panel.append(h, meta); if(field) panel.append(field); panel.append(status, row); box.append(panel); doc.body.append(box);
      go.focus({ preventScroll:true });
      const close = r => { box.remove(); resolve(r); };
      const needsPermission = () => A().state(actId) !== "ready";
      const paint = () => { if(needsPermission()){ go.textContent = prov === "google" ? "Allow sending, then send" : "Allow in Connections"; status.textContent = "First time: ÓNIX needs permission to send for you. It still asks every time."; } };
      paint();
      no.addEventListener("click", () => close({ status:"cancelled" }));
      go.addEventListener("click", async () => {
        if(needsPermission()){
          if(prov !== "google"){ close({ status:"cancelled", error:"needs permission" }); scope.OnixConnections?.open("Turn on “Send & reply”, then ask ÓNIX again."); return; }
          go.disabled = true; status.textContent = "Checking with Google…";
          const ids = A().connectorsFor("google").filter(c => c.state === "ready" || c.state === "authorized").map(c => c.id).concat("gact");
          try { await A().connectGoogle(ids); } catch(e){ status.textContent = String(e.message || e); go.disabled = false; return; }
          go.disabled = false; if(needsPermission()){ status.textContent = "Sending stayed unchecked on Google's screen, so I can't send."; return; }
          go.textContent = action.kind === "reply" ? "Send" : "Confirm"; status.textContent = "Allowed. Tap once more to send.";
          return;
        }
        const final = { ...action, ...(field ? (action.kind === "reply" ? { text:field.value } : { note:field.value }) : {}) };
        if(action.kind === "reply" && !final.text.trim()){ status.textContent = "The reply is empty."; return; }
        // Undo window
        if(field) field.disabled = true; go.remove(); no.textContent = "Undo";
        let undone = false; no.onclick = null;
        const undo = () => { undone = true; }; no.addEventListener("click", undo, { once:true });
        for(let s = 6; s > 0 && !undone; s--){ status.textContent = `Sending in ${s}… tap Undo to stop.`; await new Promise(r => setTimeout(r, 1000)); }
        if(undone){ close({ status:"undone" }); return; }
        no.disabled = true; status.textContent = "Sending…";
        try {
          const result = await run(final);
          A().log({ kind:action.kind, what:action.kind === "reply" ? `Reply to ${action.to}: ${action.subject}` : `${final.response} · ${action.title}` });
          status.textContent = "Done."; eng && (eng.kick = .8); eng?.become("check", null, 500).then(() => setTimeout(() => orb(), 1600));
          setTimeout(() => close({ status:"sent", result }), 700);
        } catch(e){ status.textContent = String(e.message || e); no.disabled = false; no.textContent = "Close"; no.addEventListener("click", () => close({ status:"failed", error:String(e.message || e) }), { once:true }); }
      });
    });
  }

  function destroy(){ clearTimeout(idleTimer); eng?.destroy(); host?.remove(); eng = null; host = null; scope.removeEventListener("resize", place); }
  const api = { mount, setState, heard, reply, showMail, showFiles, showWeek, showNumber, orb, brief, confirm, freeVoice, destroy, get mounted(){ return Boolean(host); } };
  scope.OnixHome = Object.freeze(api);
})(globalThis);
