/* ÓNIX first launch: introduce itself, connect the person's own email, learn their name,
   request Gmail, Calendar and Drive together with one Google consent, then hand over to the orb.
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
  function unlockSpeech(){ try { const u = new scope.SpeechSynthesisUtterance(" "); u.volume = 0; scope.speechSynthesis.speak(u); } catch {} }
  const say = text => Promise.all([eng.say(text), deviceSay(text)]);

  /* ---------- the full-screen layer ---------- */
  function open(label){
    host = doc.createElement("div"); host.className = "onx-host"; host.setAttribute("role", "dialog"); host.setAttribute("aria-modal", "true"); host.setAttribute("aria-label", label);
    doc.body.append(host);
    const calm = doc.documentElement.dataset.motion === "calm";
    eng = scope.OnixEngine.mount(host, { calm });
    const mute = doc.createElement("button"); mute.type = "button"; mute.className = "onx-mute"; mute.textContent = muted ? "Sound off" : "Sound on";
    mute.setAttribute("aria-pressed", String(!muted));
    mute.addEventListener("click", () => { muted = !muted; mute.textContent = muted ? "Sound off" : "Sound on"; mute.setAttribute("aria-pressed", String(!muted)); if(muted) scope.speechSynthesis?.cancel?.(); });
    host.append(mute);
    host.addEventListener("click", unlockSpeech, { once:true, capture:true });
    return eng;
  }
  async function close(){
    if(!host) return;
    const h = host, e = eng; host = null; eng = null;
    scope.speechSynthesis?.cancel?.();
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
      await say("Outlook sign-in isn't configured yet. You can use Google now or connect Outlook later.");
      const pick = await eng.choose([{ label:"Use Gmail", value:"google", primary:true }, { label:"Later", value:"later" }]);
      return pick === "google" ? mailStep("google") : finish(null);
    }
    const iconShown = eng.bigIcon("mail", n.mail);
    if(prov === "google") A().loadGoogle().catch(() => {});
    await say(prov === "google"
      ? "One Google sign-in can connect your Gmail, Calendar, and Drive in read-only mode. Google lets you choose what to share."
      : `${n.mail} it is. Tap the print to connect it. It's just you, me, and ${n.who}. Mostly ${n.who}.`);
    await iconShown; eng.hideIcon();
    const res = await eng.confirmButton({
      text:prov === "google" ? "Connect Google · Gmail, Calendar, Drive" : `Connect ${n.mail}`,
      status:`Checking with ${n.who}`, done:`${n.who} authorized`,
      onTap: () => prov === "google" ? A().connectGoogleWorkspace() : A().connectMicrosoft(["outlook"], "onboard-mail")
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
    await say(`${n.mail}'s in. And now I know your name. ${p.name || "Mystery person"}. That's you, right?`);
    const ok = await eng.choose([{ label:"That's me", value:true, primary:true }, { label:"Not me", value:false }]);
    eng.hideName(); await eng.clearSubs();
    if(!ok){
      A().signOut();
      await say("Awkward. Let's try the right account.");
      return mailStep(prov);
    }
    await nickStep(p);
    return prov === "google" ? googleWorkspaceResult(A().profile() || p, result) : extrasStep(prov, A().profile() || p);
  }
  // Google permissions were already requested at the first tap: no second OAuth popup.
  async function googleWorkspaceResult(p, result){
    const ids = NAMES.google.ids;
    const st = id => A().state(id) === "locked" ? "locked" : A().state(id) === "ready" || A().state(id) === "authorized" ? "on" : "off";
    await eng.trio([{ icon:"mail", name:"Gmail", state:st(ids[0]) }, { icon:"cal", name:"Calendar", state:st(ids[1]) }, { icon:"folder", name:"Drive", state:st(ids[2]) }]);
    if(!result.granted?.includes("gmail"))
      await say("Google signed you in, but Gmail wasn't permitted. You can grant access later from Connections.");
    else if(result.declined?.length)
      await say("Gmail is connected. Calendar or Drive wasn't approved, so it stays off until you allow it in Connections.");
    else await say("Gmail, Calendar, and Drive are connected. One account, read-only access, no extra setup screens.");
    await eng.sleep(500); eng.hideTrio(); await eng.clearSubs();
    return finish(p);
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
  async function extrasStep(prov, p){
    const n = NAMES[prov], [mailId, calId, driveId] = n.ids;
    const card = (icon, name, id) => ({ icon, name, state:A().state(id) === "locked" ? "locked" : (A().state(id) === "ready" || A().state(id) === "authorized") ? "on" : "off" });
    await eng.trio([card("mail", n.mail, mailId), card("cal", n.cal, calId), card("folder", n.drive, driveId)]);
    await say(`Good. That same account also opens your ${n.cal} and your ${n.drive}. One tap and I connect both. Want them?`);
    eng.hideTrio(); await eng.clearSubs();
    const res = await eng.confirmButton({
      text:`Connect ${n.cal} and ${n.drive}`, status:`Checking with ${n.who}`, done:"Connected",
      onTap: () => prov === "google" ? A().connectGoogle(n.ids) : A().connectMicrosoft(n.ids, "onboard-extras")
    });
    return extrasResult(prov, p, res.ok ? res.value : null);
  }
  async function extrasResult(prov, p, value){
    const n = NAMES[prov], [mailId, calId, driveId] = n.ids;
    if(!value){ A().lock(calId); A().lock(driveId); }
    const st = id => A().state(id) === "locked" ? "locked" : (A().state(id) === "ready" || A().state(id) === "authorized") ? "on" : "off";
    await eng.trio([{ icon:"mail", name:n.mail, state:st(mailId) }, { icon:"cal", name:n.cal, state:st(calId) }, { icon:"folder", name:n.drive, state:st(driveId) }]);
    eng.kick = .6;
    if(!value) await say("Locked. I won't touch them until you say so. Your call. A boring one, but yours.");
    else if(value.declined?.length) await say("Partly done. Some boxes stayed unchecked on the sign-in screen, so those stay off. Change it anytime in Connections.");
    else await say(`Done. I can see your week and your files now. Relax, I only judge the files.`);
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
  let onDoneCb = null;
  async function start({ onDone } = {}){
    if(host) return;
    onDoneCb = onDone;
    open("ÓNIX setup"); await boot();
    await eng.tapToStart("Tap to wake ÓNIX");
    await say("Hi. I'm Onix, your personal assistant. Let's get your accounts connected.");
    await eng.clearSubs();
    await say("Let's get acquainted. Where does your email live?");
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
    const remembered = A().connectorsFor(prov).filter(c => c.state === "authorized").map(c => c.id);
    const ids = prov === "google" && remembered.includes("gmail")
      ? [...new Set([...A().GOOGLE_WORKSPACE_IDS, ...remembered])] : remembered;
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
