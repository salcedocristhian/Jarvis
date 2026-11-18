/* ÓNIX first launch: introduce itself, connect the person's own email, learn their name,
   offer Calendar and Drive in one tap, then hand over to the orb.
   Speaks with the phone's built-in voice, which is free; the ElevenLabs voice is saved for real conversations. */
(function (scope) {
  "use strict";
  const doc = scope.document;
  const A = () => scope.OnixAccounts;
  let eng = null, host = null, muted = false;
  const NAMES = {
    google:    { mail:"Gmail",   cal:"Calendar", drive:"Drive",    ids:["gmail", "gcal", "gdrive"],     who:"Google" },
    microsoft: { mail:"Outlook", cal:"Calendar", drive:"OneDrive", ids:["outlook", "mscal", "onedrive"], who:"Microsoft" }
  };

  /* ---------- the phone's own voice ---------- */
  let voicePick = null;
  function pickVoice(){
    const vs = scope.speechSynthesis?.getVoices?.() || [];
    const en = vs.filter(v => /^en(-|_)US/i.test(v.lang));
    return en.find(v => /Ava|Samantha|Allison|Zoe|Evan|Nathan/i.test(v.name)) || en.find(v => v.localService) || en[0] || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  scope.speechSynthesis?.addEventListener?.("voiceschanged", () => { voicePick = pickVoice(); });
  function deviceSay(text){
    return new Promise(resolve => {
      const synth = scope.speechSynthesis;
      if(muted || !synth || typeof scope.SpeechSynthesisUtterance !== "function") return resolve();
      const u = new scope.SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 1.08; voicePick = voicePick || pickVoice(); if(voicePick) u.voice = voicePick;
      const done = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(done, 4000 + text.length*90);
      u.onend = done; u.onerror = done;
      try { synth.cancel(); synth.speak(u); } catch { done(); }
    });
  }
  // iPhones block speech until the first touch; a silent word inside that touch unlocks it.
  function unlockSpeech(){ scope.OnixVoice?.unlock(); try { const u = new scope.SpeechSynthesisUtterance(" "); u.volume = 0; scope.speechSynthesis.speak(u); } catch {} }
  // Same ElevenLabs voice as the conversation (through the ÓNIX server); the phone's voice only as a backup.
  const say = text => scope.OnixVoice ? scope.OnixVoice.say(text, (t, rate) => eng?.say(t, { rate })) : Promise.all([eng.say(text), deviceSay(text)]);

  /* ---------- the full-screen layer ---------- */
  function open(label){
    host = doc.createElement("div"); host.className = "onx-host"; host.setAttribute("role", "dialog"); host.setAttribute("aria-modal", "true"); host.setAttribute("aria-label", label);
    doc.body.append(host);
    const calm = doc.documentElement.dataset.motion === "calm";
    eng = scope.OnixEngine.mount(host, { calm });
    const mute = doc.createElement("button"); mute.type = "button"; mute.className = "onx-mute"; mute.textContent = muted ? "Sound off" : "Sound on";
    mute.setAttribute("aria-pressed", String(!muted));
    mute.addEventListener("click", () => { muted = !muted; mute.textContent = muted ? "Sound off" : "Sound on"; mute.setAttribute("aria-pressed", String(!muted)); scope.OnixVoice?.setMuted(muted); if(muted) scope.speechSynthesis?.cancel?.(); });
    host.append(mute);
    host.addEventListener("click", unlockSpeech, { once:true, capture:true });
    return eng;
  }
  async function close(){
    if(!host) return;
    const h = host, e = eng; host = null; eng = null;
    scope.speechSynthesis?.cancel?.(); scope.OnixVoice?.stop();
    await h.animate([{ opacity:1 }, { opacity:0 }], { duration:e?.calm ? 0 : 450, fill:"forwards" }).finished.catch(() => {});
    e?.destroy(); h.remove();
  }
  async function boot(){
    eng.become("scatter", null, 0);
    eng.tween(k => eng.meshIn = k, 1600, eng.ease);
    await eng.sleep(400);
    await eng.become("orb", null, 1500);
  }
  const mask = email => { const [u, d] = String(email || "").split("@"); return d ? `${u.slice(0, 1)}${"•".repeat(6)}@${d}` : ""; };

  /* ---------- steps ---------- */
  async function mailStep(prov){
    const n = NAMES[prov];
    await eng.clearSubs();
    if(prov === "microsoft" && !A().microsoftReady()){
      await say("Outlook support is still being wired up. Chris owes me that one. Let's use Google for now, or come back later.");
      const pick = await eng.choose([{ label:"Use Gmail", value:"google", primary:true }, { label:"Later", value:"later" }]);
      return pick === "google" ? mailStep("google") : finish(null);
    }
    // One tap connects mail, calendar and files together.
    const shown = eng.trio([{ icon:"mail", name:n.mail, state:"off" }, { icon:"cal", name:n.cal, state:"off" }, { icon:"folder", name:n.drive, state:"off" }]);
    if(prov === "google") A().loadGoogle().catch(() => {});
    await say(`${n.mail}, ${n.cal} and ${n.drive}. Tap the print and I connect all three at once. It's just you, me, and ${n.who}. Mostly ${n.who}.`);
    await shown; eng.hideTrio(); await eng.clearSubs();
    const res = await eng.confirmButton({
      text:`Connect ${n.who}`, status:`Checking with ${n.who}`, done:"Connected",
      onTap: () => prov === "google" ? A().connectGoogle(n.ids) : A().connectMicrosoft(n.ids, "onboard-mail")
    });
    await eng.clearSubs();
    if(!res.ok){
      await say("No email. Bold. You can connect it later from Connections.");
      return finish(null);
    }
    return nameStep(prov, res.value);
  }
  async function nameStep(prov, result){
    const p = result.profile || A().profile() || {};
    const n = NAMES[prov];
    await eng.nameplate(p.name || "Hello", mask(p.email));
    await say(`I'm in. And now I know your name. ${p.name || "Mystery person"}. That's you, right?`);
    const ok = await eng.choose([{ label:"That's me", value:true, primary:true }, { label:"Not me", value:false }]);
    eng.hideName(); await eng.clearSubs();
    if(!ok){
      A().signOut();
      await say("Awkward. Let's try the right account.");
      return mailStep(prov);
    }
    await nickStep(p);
    return extrasResult(prov, A().profile() || p, result);
  }
  async function nickStep(p){
    if(!p.name) return;
    await say(`Do I call you ${p.name}, or do you go by something else?`);
    const keep = await eng.choose([{ label:p.name, value:true, primary:true }, { label:"Something else", value:false }]);
    await eng.clearSubs();
    if(keep) return;
    await say("Go ahead. Make it good.");
    const typed = await eng.ask({ placeholder:"What should I call you?", button:"That's it", skip:"Never mind" });
    await eng.clearSubs();
    const nick = typed ? A().setNickname(typed) : p.name;
    if(nick && nick !== p.name){ await eng.nameplate(nick, ""); await say(`${nick}. Much better. I'll remember.`); eng.hideName(); await eng.clearSubs(); }
  }
  async function extrasResult(prov, p, value){
    const n = NAMES[prov], [mailId, calId, driveId] = n.ids;
    if(!value){ A().lock(calId); A().lock(driveId); }
    if(!A().profile()) return finish(null);
    const st = id => A().state(id) === "locked" ? "locked" : (A().state(id) === "ready" || A().state(id) === "authorized") ? "on" : "off";
    await eng.trio([{ icon:"mail", name:n.mail, state:st(mailId) }, { icon:"cal", name:n.cal, state:st(calId) }, { icon:"folder", name:n.drive, state:st(driveId) }]);
    eng.kick = .6;
    if(!value) await say("Locked. I won't touch them until you say so. Your call. A boring one, but yours.");
    else if(value.declined?.length) await say("Partly done. Some boxes stayed unchecked on the sign-in screen, so those stay off. Change it anytime in Connections.");
    else await say(`Mail, calendar and files. All connected. Relax, I only judge the files.`);
    await eng.sleep(500); eng.hideTrio(); await eng.clearSubs();
    return finish(p);
  }
  function when(iso){
    if(!iso) return "";
    const d = new Date(iso); if(isNaN(d)) return "";
    const day = new Date(d); day.setHours(0, 0, 0, 0); const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const diff = Math.round((day - t0)/864e5);
    const time = /T/.test(iso) ? d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" }) : "";
    const dayWord = diff === 0 ? "today" : diff === 1 ? "tomorrow" : d.toLocaleDateString("en-US", { weekday:"long" });
    return time ? `${dayWord} at ${time}` : dayWord;
  }
  async function finish(p){
    let facts = "";
    if(p){
      const s = await A().snapshot();
      if(Number.isFinite(s.unread)) facts += s.unread === 0 ? "Your inbox has zero unread. Suspicious. " : `You've got ${s.unread} unread email${s.unread === 1 ? "" : "s"}. `;
      if(s.next) facts += `Next up: ${s.next.title}, ${when(s.next.start)}. `;
    }
    await eng.become("orb", null, 900);
    const who = A().callName() || p?.name;
    await say(`${who ? `All set, ${who}. ` : "All set. "}${facts}Tap the orb whenever you need me.`);
    A().markOnboarded();
    await eng.sleep(600);
    const done = onDoneCb; onDoneCb = null;
    await close();
    done?.(p);
  }

  /* ---------- entry points ---------- */
  const INTRO1 = "Hi. I'm Onix, your new personal assistant. Chris set me up for you, so any complaints go to him.";
  const INTRO2 = "Let's get acquainted. Where does your email live?";
  let onDoneCb = null;
  async function start({ onDone } = {}){
    if(host) return;
    onDoneCb = onDone;
    open("ÓNIX setup");
    scope.OnixVoice?.prefetch([INTRO1, INTRO2]);
    await boot();
    await eng.tapToStart("Tap to wake ÓNIX");
    unlockSpeech();
    await say(INTRO1);
    await eng.clearSubs();
    await say(INTRO2);
    const prov = await eng.choose([{ label:"Gmail", value:"google", primary:true }, { label:"Outlook or Microsoft 365", value:"microsoft" }]);
    return mailStep(prov);
  }
  // Continue after Microsoft's sign-in page sends the person back.
  async function resume(result, { onDone } = {}){
    if(!result || !/^onboard-/.test(result.resume || "")) return false;
    onDoneCb = onDone;
    open("ÓNIX setup"); await boot();
    await eng.tapToStart("Tap to continue");
    if(result.error){ await say(result.error); return mailStep("microsoft"); }
    if(result.resume === "onboard-mail") return nameStep("microsoft", result);
    return extrasResult("microsoft", A().profile(), result);
  }
  // Returning people: tokens last one session, so one tap brings everything back.
  async function reconnect({ onDone } = {}){
    const p = A().profile(), prov = A().provider();
    if(!p || !prov || host) return false;
    const ids = A().connectorsFor(prov).filter(c => c.state === "authorized").map(c => c.id);
    if(!ids.length) return false;
    onDoneCb = onDone;
    open("Reconnect"); await boot();
    if(prov === "google") A().loadGoogle().catch(() => {});
    const who = A().callName();
    await eng.say(`Welcome back${who ? ", " + who : ""}. One tap and I'm back in your accounts.`);
    const res = await eng.confirmButton({
      text:`Reconnect ${NAMES[prov].who}`, status:`Checking with ${NAMES[prov].who}`, done:"Reconnected", secondary:"Not now",
      onTap: () => prov === "google" ? A().connectGoogle(ids) : A().connectMicrosoft(ids, "reconnect")
    });
    await eng.clearSubs();
    const done = onDoneCb; onDoneCb = null;
    await close(); done?.(res.ok ? p : null);
    return true;
  }
  scope.OnixOnboarding = Object.freeze({ start, resume, reconnect, get open(){ return Boolean(host); } });
})(globalThis);
