// ÓNIX accounts: names come from the sign-in, locks are respected, tokens never touch storage.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash, webcrypto } from "node:crypto";

const src = f => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const hash = s => createHash("sha256").update(s).digest("hex");
function storage(){ const m = new Map(); return { getItem:k => m.has(k) ? m.get(k) : null, setItem:(k, v) => m.set(k, String(v)), removeItem:k => m.delete(k), dump:() => [...m.entries()] }; }

function world({ search = "", userinfo, graphMe } = {}){
  const calls = [], gisRequests = [];
  const w = {
    console, URLSearchParams, TextEncoder, Intl, setTimeout, clearTimeout, Promise, Date, JSON, Math, Number, String, Array, Object, Boolean, Error,
    crypto: webcrypto, btoa: s => Buffer.from(s, "binary").toString("base64"),
    localStorage: storage(), sessionStorage: storage(),
    location: { origin:"https://salcedocristhian.github.io", pathname:"/Jarvis/", search, hash:"", assign(u){ w.location.assigned = u; } },
    history: { replaceState(_a, _b, u){ w.history.last = u; } },
    document: { getElementById: () => null },
    ONIX_CONFIG: { adminEmailHashes:[hash("chris@example.com")], google:{ clientId:"test.apps.googleusercontent.com" }, microsoft:{ clientId:"ms-client", tenant:"common" }, voice:{ guestDailySeconds:120 } },
    google: { accounts: { oauth2: {
      initTokenClient(cfg){ return { requestAccessToken(){ gisRequests.push(cfg.scope);
        const granted = cfg.scope.split(" ").filter(s => !s.endsWith("drive.metadata.readonly") || w.allowDrive);
        cfg.callback({ access_token:"g-token", expires_in:3600, scope:granted.join(" ") }); } }; },
      revoke(){ }
    } } },
    async fetch(url, opts = {}){
      calls.push({ url:String(url), opts });
      const ok = body => ({ ok:true, status:200, json:async () => body });
      if(/oauth2\/v3\/userinfo/.test(url)) return ok(userinfo || { given_name:"Douglas", name:"Douglas Reyes", email:"douglas@gmail.com" });
      if(/oauth2\/v2\.0\/token/.test(url)) return ok({ access_token:"ms-token", expires_in:3600, scope:"openid profile email User.Read Mail.Read Calendars.Read" });
      if(/graph\.microsoft\.com\/v1\.0\/me\?/.test(url)) return ok(graphMe || { givenName:"Ana", displayName:"Ana Gómez", mail:"ana@contoso.com" });
      if(/labels\/INBOX/.test(url)) return ok({ messagesUnread:7 });
      if(/calendar\/v3/.test(url)) return ok({ items:[{ summary:"Site walk", start:{ dateTime:"2026-11-18T09:00:00-05:00" } }] });
      return { ok:false, status:404, json:async () => ({}) };
    }
  };
  w.globalThis = w; w.window = w;
  vm.createContext(w);
  vm.runInContext(src("gmail-readonly.js"), w);
  vm.runInContext(src("onix-accounts.js"), w);
  return { w, A:w.OnixAccounts, calls, gisRequests };
}

// 1. A guest signs in with Gmail: ÓNIX learns their name, not Chris's.
{
  const { w, A, gisRequests } = world();
  assert.equal(A.profile(), null);
  const r = await A.connectGoogle(["gmail"]);
  assert.equal(r.profile.name, "Douglas");
  assert.equal(A.profile().email, "douglas@gmail.com");
  assert.equal(A.isAdmin(), false, "a guest is not admin");
  assert.equal(A.state("gmail"), "ready");
  assert.equal(A.state("gcal"), "off");
  assert.match(gisRequests[0], /gmail\.readonly/);
  assert.doesNotMatch(gisRequests[0], /calendar|drive/, "only asks for what was tapped");
  assert.equal(w.JarvisGmail.connected, true, "the Gmail reader adopts the same sign-in");
  const stored = JSON.stringify(w.localStorage.dump()) + JSON.stringify(w.sessionStorage.dump());
  assert.doesNotMatch(stored, /g-token/, "tokens never reach storage");
  // Snapshot is real data only
  const s = await A.snapshot();
  assert.equal(s.unread, 7);
  assert.equal(s.next, undefined, "calendar not connected, so no meeting is mentioned");
  // Guest voice budget
  assert.equal(A.budget.left(), 120);
  A.budget.add(30); assert.equal(A.budget.left(), 90);
}

// 2. Calendar and Drive: one tap. Drive left unchecked on Google's screen counts as declined.
{
  const { A, gisRequests } = world();
  await A.connectGoogle(["gmail"]);
  const r = await A.connectGoogle(["gmail", "gcal", "gdrive"]);
  assert.deepEqual([...r.granted], ["gmail", "gcal"]);
  assert.deepEqual([...r.declined], ["gdrive"]);
  assert.equal(A.state("gcal"), "ready");
  assert.equal(A.state("gdrive"), "off");
  const s = await A.snapshot();
  assert.equal(s.next.title, "Site walk");
  assert.equal(gisRequests.length, 2);
}

// 2a. One Google consent can authorize the entire read-only bundle without any write permission.
{
  const { w, A, gisRequests } = world();
  w.allowDrive = true;
  const result = await A.connectGoogleWorkspace();
  assert.deepEqual([...result.granted], ["gmail", "gcal", "gdrive"]);
  assert.deepEqual([...result.declined], []);
  assert.equal(gisRequests.length, 1, "one Google consent popup for the three services");
  assert.match(gisRequests[0], /gmail\.readonly/);
  assert.match(gisRequests[0], /calendar\.readonly/);
  assert.match(gisRequests[0], /drive\.metadata\.readonly/);
  assert.doesNotMatch(gisRequests[0], /gmail\.send|calendar\.events/, "never add send permissions automatically");
  assert.equal(A.state("gmail"), "ready");
  assert.equal(A.state("gcal"), "ready");
  assert.equal(A.state("gdrive"), "ready");
  A.disconnect("gmail");
  assert.equal(A.state("gmail"), "off", "disconnected Gmail stays off while the Google token is still valid");
  assert.equal(A.state("gcal"), "ready");
  assert.equal(A.state("gdrive"), "ready");
}

// 2b. If Google declines Drive, ÓNIX reports it instead of inventing permission.
{
  const { A, gisRequests } = world();
  const result = await A.connectGoogleWorkspace();
  assert.deepEqual([...result.granted], ["gmail", "gcal"]);
  assert.deepEqual([...result.declined], ["gdrive"]);
  assert.equal(A.state("gdrive"), "off");
  assert.equal(gisRequests.length, 1);
}

// 3. Locked connectors are never requested.
{
  const { A, gisRequests } = world();
  await A.connectGoogle(["gmail"]);
  A.lock("gcal"); A.lock("gdrive");
  await A.connectGoogle(["gmail", "gcal", "gdrive"]);
  assert.doesNotMatch(gisRequests[1], /calendar|drive/);
  assert.equal(A.state("gcal"), "locked");
  A.unlock("gcal"); assert.equal(A.state("gcal"), "off");
  A.disconnect("gmail"); assert.equal(A.state("gmail"), "off");
}

// 4. Chris is recognized by the hash of his email: admin, no voice cap.
{
  const { A } = world({ userinfo:{ given_name:"Chris", name:"Chris S", email:"Chris@Example.com" } });
  await A.connectGoogle(["gmail"]);
  assert.equal(A.profile().name, "Chris");
  assert.equal(A.isAdmin(), true);
  assert.equal(A.budget.left(), Infinity);
  A.signOut();
  assert.equal(A.profile(), null);
  assert.equal(A.onboarded(), false);
}

// 5. Microsoft: PKCE redirect out, code exchange on the way back, name from Graph.
{
  const first = world();
  first.A.connectMicrosoft(["outlook", "mscal", "onedrive"], "onboard-extras");
  await new Promise(r => setTimeout(r, 20));
  const url = new URL(first.w.location.assigned);
  assert.equal(url.origin + url.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.equal(url.searchParams.get("redirect_uri"), "https://salcedocristhian.github.io/Jarvis/");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("scope"), /Mail\.Read Calendars\.Read Files\.Read/);
  const state = url.searchParams.get("state");
  // Coming back: same browser tab, so sessionStorage carries the verifier.
  const back = world({ search:`?code=abc&state=${state}` });
  back.w.sessionStorage = first.w.sessionStorage;
  vm.runInContext(src("onix-accounts.js"), back.w);
  const r = await back.w.OnixAccounts.handleRedirect();
  assert.equal(r.resume, "onboard-extras");
  assert.equal(r.profile.name, "Ana");
  assert.deepEqual([...r.declined], ["onedrive"]);
  const tokenCall = back.calls.find(c => /\/token$/.test(c.url));
  assert.match(String(tokenCall.opts.body), /code_verifier=/);
  assert.equal(back.w.history.last, "https://salcedocristhian.github.io/Jarvis/", "the code is wiped from the address bar");
  // A forged return with the wrong state is ignored.
  const forged = world({ search:"?code=abc&state=nope" });
  forged.w.sessionStorage = first.w.sessionStorage;
  assert.equal(await forged.A.handleRedirect(), null);
}

// 6. Nicknames: the person chooses what ÓNIX calls them; it survives reconnecting.
{
  const { A } = world();
  await A.connectGoogle(["gmail"]);
  assert.equal(A.callName(), "Douglas");
  assert.equal(A.setNickname("  Doug  "), "Doug");
  assert.equal(A.setNickname("<script>Doug</script>2"), "scriptDougscript", "only letters survive");
  A.setNickname("Doug");
  await A.connectGoogle(["gmail", "gcal"]);
  assert.equal(A.callName(), "Doug", "reconnecting keeps the nickname");
  assert.equal(A.profile().name, "Douglas", "the real name stays as Google says");
  A.setNickname("douglas"); assert.equal(A.profile().nick, undefined, "same as real name = no nickname");
  A.setNickname("José Ñandú"); assert.equal(A.callName(), "José Ñandú");
}

console.log("onix-accounts ok");
