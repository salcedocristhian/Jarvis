// ÓNIX data: Gmail and Microsoft read the same way; replies can't inject headers; writes need the actions permission.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
const src = f => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
function storage(){ const m = new Map(); return { getItem:k => m.has(k) ? m.get(k) : null, setItem:(k, v) => m.set(k, String(v)), removeItem:k => m.delete(k) }; }
const b64 = s => Buffer.from(s, "utf8").toString("base64url");

function world(provider){
  const calls = [];
  const w = { console, URLSearchParams, TextEncoder, TextDecoder, Intl, setTimeout, clearTimeout, Promise, Date, JSON, Math, Number, String, Array, Object, Boolean, Error, Map, Uint8Array,
    crypto:webcrypto, btoa:s => Buffer.from(s, "binary").toString("base64"), atob:s => Buffer.from(s, "base64").toString("binary"),
    localStorage:storage(), sessionStorage:storage(), location:{ origin:"https://salcedocristhian.github.io", pathname:"/Jarvis/", search:"", hash:"", assign(){} }, history:{ replaceState(){} },
    document:{ getElementById:() => null },
    ONIX_CONFIG:{ adminEmailHashes:[], google:{ clientId:"x" }, microsoft:{ clientId:"m" } },
    google:{ accounts:{ oauth2:{ initTokenClient(cfg){ return { requestAccessToken(){ cfg.callback({ access_token:"g", expires_in:3600, scope:cfg.scope }); } }; }, revoke(){} } } },
    async fetch(url, o = {}){
      url = String(url); calls.push({ url, o });
      const ok = b => ({ ok:true, status:200, json:async () => b });
      if(/userinfo/.test(url)) return ok({ given_name:"Doug", email:"doug@gmail.com" });
      if(/gmail.*\/messages\?/.test(url)) return ok({ messages:[{ id:"m1" }], resultSizeEstimate:4 });
      if(/gmail.*\/messages\/m1\?format=metadata/.test(url)) return ok({ id:"m1", threadId:"t1", internalDate:"1763400000000", labelIds:["UNREAD", "INBOX"], snippet:"Can you &amp; Tiana confirm?",
        payload:{ headers:[{ name:"From", value:'"Tiana P" <tiana@bldg.com>' }, { name:"Subject", value:"Lighting hearing" }] } });
      if(/gmail.*\/messages\/m1\?format=full/.test(url)) return ok({ id:"m1", threadId:"t1", internalDate:"1763400000000", labelIds:[], snippet:"",
        payload:{ mimeType:"multipart/alternative", headers:[{ name:"From", value:"Evil <evil@x.com>\r\nBcc: victim@x.com" }, { name:"Subject", value:"Hi\r\nBcc: victim2@x.com" }, { name:"Message-ID", value:"<abc@x>" }],
          parts:[{ mimeType:"text/plain", body:{ data:b64("Hello there") } }] } });
      if(/gmail.*\/messages\/send/.test(url)) return ok({ id:"sent1" });
      if(/calendar\/v3\/calendars\/primary\/events\/e1$/.test(url)) return ok({ id:"e1", summary:"Permit meeting", attendees:[{ email:"doug@gmail.com", self:true, responseStatus:"needsAction" }, { email:"boss@x.com", responseStatus:"accepted" }] });
      if(/calendar\/v3\/calendars\/primary\/events\/e1\?sendUpdates=all/.test(url)) return ok({});
      if(/calendar\/v3/.test(url)) return ok({ items:[{ id:"e1", summary:"Permit meeting", start:{ dateTime:"2026-11-18T11:00:00-05:00" }, end:{ dateTime:"2026-11-18T11:30:00-05:00" }, attendees:[{ self:true, responseStatus:"needsAction" }] }] });
      if(/oauth2\/v2\.0\/token/.test(url)) return ok({ access_token:"ms", expires_in:3600, scope:"User.Read Mail.Read Calendars.Read Files.Read Mail.Send Calendars.ReadWrite" });
      if(/graph.microsoft.com\/v1.0\/me\?/.test(url)) return ok({ givenName:"Ana", mail:"ana@contoso.com" });
      if(/graph.*mailFolders\/inbox\/messages/.test(url)) return ok({ value:[{ id:"g1", subject:"Invoice", from:{ emailAddress:{ name:"Bob", address:"bob@x.com" } }, receivedDateTime:"2026-11-17T12:00:00Z", isRead:false, bodyPreview:"Pay me" }] });
      if(/graph.*\/messages\/g1\/reply/.test(url)) return { ok:true, status:202, json:async () => ({}) };
      if(/graph.*\/messages\/g1\?/.test(url)) return ok({ id:"g1", subject:"Invoice", from:{ emailAddress:{ name:"Bob", address:"bob@x.com" } }, body:{ content:"Pay me" }, toRecipients:[] });
      if(/graph.*\/events\/x1\/accept/.test(url)) return { ok:true, status:202, json:async () => ({}) };
      if(/graph.*\/drive\/root\/search/.test(url)) return ok({ value:[{ id:"f1", name:"Plans.pdf", webUrl:"https://x", lastModifiedDateTime:"2026-11-01T00:00:00Z", file:{} }] });
      return { ok:false, status:404, json:async () => ({}) };
    } };
  w.globalThis = w; w.window = w; vm.createContext(w);
  vm.runInContext(src("gmail-readonly.js"), w); vm.runInContext(src("onix-accounts.js"), w); vm.runInContext(src("onix-data.js"), w);
  return { w, A:w.OnixAccounts, D:w.OnixData, calls };
}

// Google
{
  const { A, D, calls } = world();
  await A.connectGoogle(["gmail", "gcal"]);
  const r = await D.mail.search("unread", 5);
  assert.equal(r.items[0].from, "Tiana P"); assert.equal(r.items[0].fromEmail, "tiana@bldg.com");
  assert.equal(r.items[0].snippet, "Can you & Tiana confirm?"); assert.equal(r.items[0].unread, true);
  assert.match(calls.find(c => /messages\?maxResults/.test(c.url)).url, /q=is%3Aunread/);
  const ev = await D.cal.range(new Date("2026-11-18"), new Date("2026-11-19"));
  assert.equal(ev[0].response, "needsAction");
  // No write without the actions permission
  await assert.rejects(D.mail.reply("m1", "Thanks"), /isn't connected/);
  await assert.rejects(D.cal.respond("e1", "accept"), /isn't connected/);
  await A.connectGoogle(["gmail", "gcal", "gact"]);
  const sent = await D.mail.reply("m1", "Thanks, confirmed. Ñ ok.");
  assert.equal(sent.ok, true);
  const raw = Buffer.from(JSON.parse(calls.find(c => /messages\/send/.test(c.url)).o.body).raw, "base64url").toString("utf8");
  const head = raw.split("\r\n\r\n")[0];
  assert.doesNotMatch(head, /^Bcc:/mi, "line breaks in From/Subject can't add headers");
  assert.match(head, /^In-Reply-To: <abc@x>$/m);
  assert.match(head, /^Subject: Re: Hi Bcc: victim2@x\.com$/m);
  assert.equal(Buffer.from(raw.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8"), "Thanks, confirmed. Ñ ok.");
  assert.equal(JSON.parse(calls.find(c => /messages\/send/.test(c.url)).o.body).threadId, "t1");
  await D.cal.respond("e1", "accept");
  const patch = JSON.parse(calls.find(c => /sendUpdates=all/.test(c.url)).o.body);
  assert.equal(patch.attendees.find(a => a.self).responseStatus, "accepted");
  assert.equal(patch.attendees.find(a => !a.self).responseStatus, "accepted", "other guests untouched");
  await assert.rejects(D.mail.reply("m1", "   "), /empty/);
}
// Microsoft
{
  const first = world();
  first.A.connectMicrosoft(["outlook", "mscal", "onedrive", "msact"], "connectors");
  await new Promise(r => setTimeout(r, 20));
  const st = JSON.parse(first.w.sessionStorage.getItem("una.onix.ms.pkce")).state;
  const back = world(); back.w.sessionStorage = first.w.sessionStorage; back.w.location.search = `?code=c&state=${st}`;
  vm.runInContext(src("onix-accounts.js"), back.w); vm.runInContext(src("onix-data.js"), back.w);
  const A = back.w.OnixAccounts, D = back.w.OnixData;
  await A.handleRedirect();
  assert.equal(A.state("msact"), "ready");
  const r = await D.mail.search("unread");
  assert.equal(r.items[0].from, "Bob");
  assert.match(back.calls.find(c => /mailFolders\/inbox\/messages/.test(c.url)).url, /isRead%20eq%20false/);
  await D.mail.reply("g1", "Paid.");
  assert.deepEqual(JSON.parse(back.calls.find(c => /g1\/reply/.test(c.url)).o.body), { comment:"Paid." });
  await D.cal.respond("x1", "accepted");
  const f = await D.drive.search("plans");
  assert.equal(f[0].name, "Plans.pdf");
}
console.log("✓ ÓNIX data: Gmail + Microsoft mail, calendar, files; replies safe from header injection; writes only with Send & reply allowed");
