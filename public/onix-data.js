/* ÓNIX data: one way to read mail, calendar and files, whether the person uses Google or Microsoft.
   Reading is free to call. Writing (reply, answer an invite) is only called by onix-home.js
   after the person approved the exact text on screen and the undo window closed. */
(function (scope) {
  "use strict";
  const A = () => scope.OnixAccounts;
  const prov = () => A()?.provider();
  const GM = "https://gmail.googleapis.com/gmail/v1/users/me";
  const GC = "https://www.googleapis.com/calendar/v3/calendars/primary";
  const MG = "https://graph.microsoft.com/v1.0/me";
  const cut = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const need = id => { if(A().state(id) !== "ready") throw new Error(`${A().CONNECTORS[id].name} isn't connected. Open Connections.`); };
  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  /* ---------- mail ---------- */
  const header = (m, name) => (m.payload?.headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  const who = from => { const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/); return m ? { name:cut(m[1] || m[2], 60), email:cut(m[2], 120) } : { name:cut(from, 60), email:cut(from, 120) }; };
  function gmailItem(m){
    const f = who(header(m, "From"));
    return { id:m.id, thread:m.threadId, from:f.name, fromEmail:f.email, subject:cut(header(m, "Subject") || "(no subject)", 140),
      date:new Date(Number(m.internalDate) || header(m, "Date")).toISOString(), unread:(m.labelIds || []).includes("UNREAD"),
      important:(m.labelIds || []).includes("IMPORTANT"), snippet:cut(decodeEntities(m.snippet), 220) };
  }
  function decodeEntities(s){ return String(s || "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'"); }
  function graphItem(m){
    return { id:m.id, thread:m.conversationId, from:cut(m.from?.emailAddress?.name || m.from?.emailAddress?.address, 60), fromEmail:cut(m.from?.emailAddress?.address, 120),
      subject:cut(m.subject || "(no subject)", 140), date:m.receivedDateTime, unread:m.isRead === false, important:m.importance === "high" || m.inferenceClassification === "focused",
      snippet:cut(m.bodyPreview, 220) };
  }
  // query: free words, or "unread", "important", "from:name", "today".
  async function mailSearch(query = "", limit = 8){
    const n = Math.max(1, Math.min(15, Number(limit) || 8)), q = cut(query, 120).replace(/\bin:inbox\b/i, "").trim();
    if(prov() === "google"){
      need("gmail");
      let gq = q.replace(/\bunread\b/i, "is:unread").replace(/\bimportant\b/i, "is:important").replace(/\btoday\b/i, "newer_than:1d");
      if(!gq) gq = "in:inbox";
      const list = await A().call("google", `${GM}/messages?maxResults=${n}&q=${encodeURIComponent(gq)}`);
      const ids = (list.messages || []).map(m => m.id);
      const items = await Promise.all(ids.map(id => A().call("google", `${GM}/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`).then(gmailItem)));
      return { items, total:Number(list.resultSizeEstimate) || items.length };
    }
    if(prov() === "microsoft"){
      need("outlook");
      const sel = "$select=id,conversationId,subject,from,receivedDateTime,isRead,importance,inferenceClassification,bodyPreview";
      let url;
      const from = q.match(/from:\s*(\S+)/i), words = q.replace(/from:\s*\S+/i, "").replace(/\b(unread|important|today)\b/ig, "").trim();
      if(words || from) url = `${MG}/messages?$top=${n}&${sel}&$search=${encodeURIComponent('"' + [words, from ? "from:" + from[1] : ""].filter(Boolean).join(" ").replace(/"/g, "") + '"')}`;
      else {
        const f = [];
        if(/\bunread\b/i.test(q)) f.push("isRead eq false");
        if(/\bimportant\b/i.test(q)) f.push("inferenceClassification eq 'focused'");
        if(/\btoday\b/i.test(q)){ const d = new Date(); d.setHours(0, 0, 0, 0); f.push(`receivedDateTime ge ${d.toISOString()}`); }
        url = `${MG}/mailFolders/inbox/messages?$top=${n}&${sel}&$orderby=receivedDateTime desc` + (f.length ? `&$filter=${encodeURIComponent(f.join(" and "))}` : "");
      }
      const r = await A().call("microsoft", url);
      return { items:(r.value || []).map(graphItem), total:(r.value || []).length };
    }
    throw new Error("No email connected.");
  }
  function b64urlDecode(s){ try { const bin = scope.atob(String(s).replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); } catch { return ""; } }
  function plainFrom(part){
    if(!part) return "";
    if(part.mimeType === "text/plain" && part.body?.data) return b64urlDecode(part.body.data);
    for(const p of part.parts || []){ const t = plainFrom(p); if(t) return t; }
    if(part.mimeType === "text/html" && part.body?.data) return stripHtml(b64urlDecode(part.body.data));
    return "";
  }
  function stripHtml(h){ return decodeEntities(String(h).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim(); }
  async function mailRead(id){
    if(prov() === "google"){
      need("gmail");
      const m = await A().call("google", `${GM}/messages/${encodeURIComponent(id)}?format=full`);
      return { ...gmailItem(m), to:cut(header(m, "To"), 300), replyTo:cut(header(m, "Reply-To"), 200), messageId:cut(header(m, "Message-ID"), 300),
        references:cut(header(m, "References"), 900), body:plainFrom(m.payload).slice(0, 6000) };
    }
    need("outlook");
    const m = await A().call("microsoft", `${MG}/messages/${encodeURIComponent(id)}?$select=id,conversationId,subject,from,receivedDateTime,isRead,importance,bodyPreview,body,toRecipients`,
      { headers:{ Prefer:'outlook.body-content-type="text"' } });
    return { ...graphItem(m), to:(m.toRecipients || []).map(r => r.emailAddress?.address).join(", "), body:cut(m.body?.content, 6000) };
  }
  // RFC 2822 reply for Gmail. Header values lose any line break so nothing can be injected.
  const oneLine = s => String(s || "").replace(/[\r\n]+/g, " ").trim();
  const b64utf8 = s => scope.btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const b64url = s => b64utf8(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`;
  function buildReply(orig, text){
    const to = oneLine(orig.replyTo || orig.fromEmail);
    const subj = oneLine(/^re:/i.test(orig.subject) ? orig.subject : "Re: " + orig.subject);
    const refs = oneLine([orig.references, orig.messageId].filter(Boolean).join(" "));
    const lines = [`To: ${to}`, `Subject: ${encWord(subj)}`];
    if(orig.messageId) lines.push(`In-Reply-To: ${oneLine(orig.messageId)}`, `References: ${refs}`);
    lines.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64utf8(String(text)).replace(/.{76}/g, "$&\r\n"));
    return lines.join("\r\n");
  }
  async function mailReply(id, text){
    const body = String(text || "").trim().slice(0, 5000);
    if(!body) throw new Error("The reply is empty.");
    if(prov() === "google"){
      need("gact");
      const orig = await mailRead(id);
      const r = await A().call("google", `${GM}/messages/send`, { method:"POST", body:{ raw:b64url(buildReply(orig, body)), threadId:orig.thread } });
      return { ok:true, id:r.id, to:orig.replyTo || orig.fromEmail, subject:orig.subject };
    }
    need("msact");
    const orig = await mailRead(id);
    await A().call("microsoft", `${MG}/messages/${encodeURIComponent(id)}/reply`, { method:"POST", body:{ comment:body } });
    return { ok:true, to:orig.fromEmail, subject:orig.subject };
  }
  async function unreadInfo(){
    if(prov() === "google"){
      need("gmail");
      const [inbox, imp] = await Promise.all([A().call("google", `${GM}/labels/INBOX`), A().call("google", `${GM}/messages?maxResults=1&q=${encodeURIComponent("is:unread is:important in:inbox")}`)]);
      return { unread:Number(inbox.messagesUnread) || 0, important:Number(imp.resultSizeEstimate) || 0 };
    }
    need("outlook");
    const [inbox, foc] = await Promise.all([A().call("microsoft", `${MG}/mailFolders/inbox?$select=unreadItemCount`),
      A().call("microsoft", `${MG}/mailFolders/inbox/messages?$top=50&$select=id&$filter=${encodeURIComponent("isRead eq false and inferenceClassification eq 'focused'")}`)]);
    return { unread:Number(inbox.unreadItemCount) || 0, important:(foc.value || []).length };
  }

  /* ---------- calendar ---------- */
  const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  function gEvent(e){
    const me = (e.attendees || []).find(a => a.self);
    return { id:e.id, title:cut(e.summary || "Busy", 120), start:e.start?.dateTime || e.start?.date, end:e.end?.dateTime || e.end?.date, allDay:!e.start?.dateTime,
      where:cut(e.location || e.hangoutLink || "", 120), organizer:cut(e.organizer?.displayName || e.organizer?.email, 80),
      response:me ? me.responseStatus : "organizer", online:Boolean(e.hangoutLink || e.conferenceData) };
  }
  function mEvent(e){
    const map = { accepted:"accepted", tentativelyAccepted:"tentative", declined:"declined", notResponded:"needsAction", none:"needsAction", organizer:"organizer" };
    return { id:e.id, title:cut(e.subject || "Busy", 120), start:e.start?.dateTime, end:e.end?.dateTime, allDay:Boolean(e.isAllDay),
      where:cut(e.location?.displayName || "", 120), organizer:cut(e.organizer?.emailAddress?.name, 80), response:map[e.responseStatus?.response] || "needsAction", online:Boolean(e.isOnlineMeeting) };
  }
  async function calRange(from, to){
    const a = from ? new Date(from) : dayStart(new Date()), b = to ? new Date(to) : new Date(a.getTime() + 864e5);
    if(isNaN(a) || isNaN(b)) throw new Error("I couldn't read those dates.");
    if(prov() === "google"){
      need("gcal");
      const r = await A().call("google", `${GC}/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(a.toISOString())}&timeMax=${encodeURIComponent(b.toISOString())}`);
      return (r.items || []).filter(e => e.status !== "cancelled").map(gEvent);
    }
    need("mscal");
    const r = await A().call("microsoft", `${MG}/calendarView?startDateTime=${encodeURIComponent(a.toISOString())}&endDateTime=${encodeURIComponent(b.toISOString())}&$orderby=start/dateTime&$top=50&$select=id,subject,start,end,isAllDay,location,organizer,responseStatus,isOnlineMeeting`,
      { headers:{ Prefer:`outlook.timezone="${tz()}"` } });
    return (r.value || []).map(mEvent);
  }
  // response: accepted | declined | tentative
  async function calRespond(id, response, note = ""){
    const resp = { accept:"accepted", accepted:"accepted", decline:"declined", declined:"declined", tentative:"tentative", maybe:"tentative" }[String(response).toLowerCase()];
    if(!resp) throw new Error("Answer must be accept, decline or tentative.");
    if(prov() === "google"){
      need("gact");
      const e = await A().call("google", `${GC}/events/${encodeURIComponent(id)}`);
      const attendees = (e.attendees || []).map(a => a.self ? { ...a, responseStatus:resp, ...(note ? { comment:cut(note, 300) } : {}) } : a);
      if(!attendees.some(a => a.self)) throw new Error("You're not on the guest list of that event.");
      await A().call("google", `${GC}/events/${encodeURIComponent(id)}?sendUpdates=all`, { method:"PATCH", body:{ attendees } });
      return { ok:true, title:cut(e.summary, 120), response:resp };
    }
    need("msact");
    const verb = { accepted:"accept", declined:"decline", tentative:"tentativelyAccept" }[resp];
    await A().call("microsoft", `${MG}/events/${encodeURIComponent(id)}/${verb}`, { method:"POST", body:{ sendResponse:true, comment:cut(note, 300) } });
    return { ok:true, response:resp };
  }

  /* ---------- files ---------- */
  async function driveSearch(query = "", limit = 8){
    const n = Math.max(1, Math.min(15, Number(limit) || 8)), q = cut(query, 80);
    if(prov() === "google"){
      need("gdrive");
      const filter = (q ? `name contains '${q.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and ` : "") + "trashed = false";
      const r = await A().call("google", `https://www.googleapis.com/drive/v3/files?pageSize=${n}&orderBy=modifiedTime%20desc&q=${encodeURIComponent(filter)}&fields=${encodeURIComponent("files(id,name,mimeType,modifiedTime,webViewLink)")}`);
      return (r.files || []).map(f => ({ id:f.id, name:cut(f.name, 120), modified:f.modifiedTime, link:f.webViewLink || "", kind:cut(String(f.mimeType).split(/[./]/).pop(), 30) }));
    }
    need("onedrive");
    const url = q ? `${MG}/drive/root/search(q='${encodeURIComponent(q.replace(/'/g, "''"))}')?$top=${n}&$select=id,name,webUrl,lastModifiedDateTime,file,folder`
      : `${MG}/drive/recent?$top=${n}&$select=id,name,webUrl,lastModifiedDateTime,file,folder`;
    const r = await A().call("microsoft", url);
    return (r.value || []).map(f => ({ id:f.id, name:cut(f.name, 120), modified:f.lastModifiedDateTime, link:f.webUrl || "", kind:f.folder ? "folder" : cut(String(f.name).split(".").pop(), 12) }));
  }

  scope.OnixData = Object.freeze({
    mail:{ search:mailSearch, read:mailRead, reply:mailReply, unread:unreadInfo },
    cal:{ range:calRange, respond:calRespond },
    drive:{ search:driveSearch },
    _buildReply:buildReply
  });
})(globalThis);
