/* ÓNIX client tools for the ElevenLabs agent. Each one reads real data from the person's own accounts,
   shows it with the orb, and answers the agent with short JSON. Writing tools never write:
   they put the exact text on screen and the person decides. The result reaches the agent as a context note. */
(function (scope) {
  "use strict";
  const A = () => scope.OnixAccounts, D = () => scope.OnixData, H = () => scope.OnixHome, AG = () => scope.JarvisElevenAgent;
  const out = o => JSON.stringify(o);
  const fail = e => out({ ok:false, error:String(e?.message || e).slice(0, 200) });
  const when = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-US", { weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }); };
  const dateOnly = s => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const cache = { mail:new Map(), events:new Map() };
  const tell = text => { try { AG()?.context?.(text); } catch {} };

  async function mail_search({ query = "", limit = 6 } = {}){
    try {
      const r = await D().mail.search(query, limit);
      r.items.forEach(m => cache.mail.set(m.id, m));
      H()?.showMail(r.items, { total:r.total });
      return out({ ok:true, total_estimate:r.total, emails:r.items.map(m => ({ email_id:m.id, from:m.from, from_email:m.fromEmail, subject:m.subject, received:when(m.date), unread:m.unread, preview:m.snippet })) });
    } catch(e){ return fail(e); }
  }
  async function mail_read({ email_id } = {}){
    try {
      const m = await D().mail.read(String(email_id || ""));
      cache.mail.set(m.id, m);
      H()?.showMail([m]);
      return out({ ok:true, email_id:m.id, from:m.from, from_email:m.fromEmail, to:m.to, subject:m.subject, received:when(m.date), body:m.body.slice(0, 3500) });
    } catch(e){ return fail(e); }
  }
  async function calendar_read({ start_date, end_date } = {}){
    try {
      const a = dateOnly(start_date) || (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
      const b0 = dateOnly(end_date), b = b0 ? new Date(b0.getTime() + 864e5) : new Date(a.getTime() + 864e5);
      if((b - a)/864e5 > 31) return out({ ok:false, error:"Ask for 31 days or less." });
      const evs = await D().cal.range(a, b);
      evs.forEach(e => cache.events.set(e.id, e));
      // Show the week around the first day asked, with the real counts.
      const wk = await D().cal.range(new Date(Math.min(a, Date.now() - 0)).setHours(0, 0, 0, 0), new Date(a.getTime() + 7*864e5)).catch(() => evs);
      H()?.showWeek(wk, a);
      return out({ ok:true, from:a.toDateString(), events:evs.map(e => ({ event_id:e.id, title:e.title, start:e.allDay ? "all day " + new Date(e.start).toDateString() : when(e.start), end:e.allDay ? "" : when(e.end), where:e.where, organizer:e.organizer, my_answer:e.response })) });
    } catch(e){ return fail(e); }
  }
  async function drive_search({ query = "" } = {}){
    try {
      const f = await D().drive.search(query, 8);
      H()?.showFiles(f);
      return out({ ok:true, files:f.map(x => ({ name:x.name, kind:x.kind, modified:when(x.modified), link:x.link })) });
    } catch(e){ return fail(e); }
  }
  // Puts the reply on screen. Never sends by itself.
  async function reply_email({ email_id, text } = {}){
    const id = String(email_id || ""), body = String(text || "").trim();
    if(!id || !body) return out({ ok:false, error:"Need email_id and the reply text." });
    let m = cache.mail.get(id);
    try { if(!m) { m = await D().mail.read(id); cache.mail.set(id, m); } } catch(e){ return fail(e); }
    H()?.confirm({ kind:"reply", to:m.fromEmail || m.from, subject:m.subject, text:body }, final => D().mail.reply(id, final.text))
      .then(r => tell(`ACTION_RESULT reply to "${m.subject}": ${r.status}${r.error ? " (" + r.error + ")" : ""}. Tell the person in one short line.`));
    return out({ ok:true, status:"waiting_for_approval", note:"The exact reply is on screen. The person taps Send or Cancel. You'll get an ACTION_RESULT note. Don't say it was sent until then." });
  }
  async function answer_invite({ event_id, response, note = "" } = {}){
    const id = String(event_id || ""), resp = { accept:"accepted", accepted:"accepted", decline:"declined", declined:"declined", tentative:"tentative", maybe:"tentative" }[String(response || "").toLowerCase()];
    if(!id || !resp) return out({ ok:false, error:"Need event_id and response: accept, decline or tentative." });
    const e = cache.events.get(id) || { title:"this event" };
    H()?.confirm({ kind:"rsvp", title:e.title, when:e.start ? when(e.start) : "", response:resp, note:String(note || "") }, final => D().cal.respond(id, resp, final.note))
      .then(r => tell(`ACTION_RESULT ${resp} "${e.title}": ${r.status}${r.error ? " (" + r.error + ")" : ""}. Tell the person in one short line.`));
    return out({ ok:true, status:"waiting_for_approval", note:"The answer is on screen for approval. Wait for ACTION_RESULT." });
  }
  async function web_search({ query = "" } = {}){
    const q = String(query).trim().slice(0, 200);
    if(!q) return out({ ok:false, error:"Empty search." });
    if(!scope.OnixChat?.ready()) return out({ ok:false, error:"Web search isn't set up yet." });
    try { return out({ ok:true, results:await scope.OnixChat.search(q) }); } catch(e){ return fail(e); }
  }
  // The old Gmail tool name still works, answered by the new reader.
  const gmail_read = ({ question } = {}) => {
    const q = String(question || ""), filt = /unread|sin leer|no le[ií]d/i.test(q) ? "unread" : /important|importante/i.test(q) ? "important" : /today|hoy/i.test(q) ? "today" : "";
    const from = q.match(/\b(?:from|de)\s+([\p{L}\d.@-]{3,40})/iu);
    return mail_search({ query:[filt, from ? "from:" + from[1] : ""].filter(Boolean).join(" "), limit:6 });
  };

  scope.OnixTools = Object.freeze({
    handlers: () => ({ mail_search, mail_read, calendar_read, drive_search, reply_email, answer_invite, web_search, gmail_read }),
    _cache:cache
  });
})(globalThis);
