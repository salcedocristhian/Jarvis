/* ÓNIX accounts: each person signs in with their own Google or Microsoft account.
   - Access tokens live only in JS memory. Nothing secret is stored.
   - localStorage keeps the profile (name, email) and each connector's state: off, authorized or locked.
   - A locked connector is never requested from Google or Microsoft until the user unlocks it.
   - Microsoft uses authorization code + PKCE with a redirect; the one-time verifier sits in sessionStorage. */
(function (scope) {
  "use strict";
  const CFG = scope.ONIX_CONFIG || {};
  const KEY = "una.onix.";
  const ls = {
    get(k, d){ try { const v = scope.localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v){ try { scope.localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} },
    del(k){ try { scope.localStorage.removeItem(KEY + k); } catch {} }
  };
  const ss = {
    get(k){ try { const v = scope.sessionStorage.getItem(KEY + k); return v == null ? null : JSON.parse(v); } catch { return null; } },
    set(k, v){ try { scope.sessionStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} },
    del(k){ try { scope.sessionStorage.removeItem(KEY + k); } catch {} }
  };

  const G = "https://www.googleapis.com/auth/";
  const CONNECTORS = {
    gmail:    { provider:"google",    name:"Gmail",    icon:"mail",   scopes:[G + "gmail.readonly"] },
    gcal:     { provider:"google",    name:"Calendar", icon:"cal",    scopes:[G + "calendar.readonly"] },
    gdrive:   { provider:"google",    name:"Drive",    icon:"folder", scopes:[G + "drive.metadata.readonly"] },
    outlook:  { provider:"microsoft", name:"Outlook",  icon:"mail",   scopes:["Mail.Read"] },
    mscal:    { provider:"microsoft", name:"Calendar", icon:"cal",    scopes:["Calendars.Read"] },
    onedrive: { provider:"microsoft", name:"OneDrive", icon:"folder", scopes:["Files.Read"] },
    // Actions: ÓNIX may send a reply or answer an invite, always after the person approves the exact text on screen.
    gact:     { provider:"google",    name:"Send & reply", icon:"check", action:true, scopes:[G + "gmail.send", G + "calendar.events"] },
    msact:    { provider:"microsoft", name:"Send & reply", icon:"check", action:true, scopes:["Mail.Send", "Calendars.ReadWrite"] }
  };
  const BASE = { google:["openid", "email", "profile"], microsoft:["openid", "profile", "email", "offline_access", "User.Read"] };
  const ORDER = { google:["gmail", "gcal", "gdrive", "gact"], microsoft:["outlook", "mscal", "onedrive", "msact"] };

  const tokens = { google:null, microsoft:null };           // { value, exp, scope }
  const live = tok => Boolean(tok && tok.value && Date.now() < tok.exp - 60000);

  /* ---------- profile and connector state ---------- */
  const profile = () => ls.get("profile", null);
  function setProfile(p){ ls.set("profile", p); }
  const states = () => ls.get("connectors", {});
  function setState(id, state){ const s = states(); s[id] = { state, at:new Date().toISOString() }; ls.set("connectors", s); }
  function state(id){
    const c = CONNECTORS[id]; if(!c) return "off";
    const saved = states()[id]?.state || "off";
    if(saved === "locked") return "locked";
    const tok = tokens[c.provider];
    if(live(tok) && c.scopes.every(sc => tok.scope.includes(sc))) return "ready";
    return saved === "authorized" ? "authorized" : "off";
  }
  function lock(id){ setState(id, "locked"); }
  function unlock(id){ if(states()[id]?.state === "locked") setState(id, "off"); }
  const onboarded = () => Boolean(ls.get("onboarded", false));
  function markOnboarded(){ ls.set("onboarded", true); }
  const provider = () => profile()?.provider || null;
  const connectorsFor = p => (ORDER[p] || []).map(id => ({ id, ...CONNECTORS[id], state:state(id) }));

  async function sha256(text){
    const data = new TextEncoder().encode(String(text || "").trim().toLowerCase());
    const buf = await scope.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const isAdmin = () => Boolean(profile()?.admin);
  // What ÓNIX calls the person: their nickname if they chose one, otherwise the first name from the sign-in.
  const cleanNick = n => String(n || "").normalize("NFC").replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
  const callName = () => profile()?.nick || profile()?.name || "";
  function setNickname(n){
    const p = profile(); if(!p) return "";
    const nick = cleanNick(n);
    if(nick && nick.toLowerCase() !== String(p.name || "").toLowerCase()) p.nick = nick; else delete p.nick;
    setProfile(p); return callName();
  }
  // A new sign-in replaces the profile but keeps the nickname when it is the same person.
  function keepNick(p){ const old = profile(); if(old?.nick && old.email && old.email.toLowerCase() === p.email.toLowerCase()) p.nick = old.nick; return p; }

  /* ---------- Google (Identity Services token flow) ---------- */
  let gisPromise = null, gClient = null, gWaiting = null;
  function loadGoogle(){
    if(scope.google?.accounts?.oauth2?.initTokenClient) return Promise.resolve(true);
    if(gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const existing = scope.document.getElementById("google-identity-services");
      const done = () => scope.google?.accounts?.oauth2 ? resolve(true) : reject(new Error("Google sign-in didn't load."));
      if(existing){ existing.addEventListener("load", done, { once:true }); existing.addEventListener("error", () => reject(new Error("Google sign-in didn't load.")), { once:true });
        setTimeout(() => scope.google?.accounts?.oauth2 && resolve(true), 50); return; }
      const s = scope.document.createElement("script"); s.id = "google-identity-services"; s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = done; s.onerror = () => reject(new Error("Google sign-in didn't load.")); scope.document.head.append(s);
    }).catch(e => { gisPromise = null; throw e; });
    return gisPromise;
  }
  const googleReady = () => Boolean(scope.google?.accounts?.oauth2?.initTokenClient && CFG.google?.clientId);
  // Must be called inside a tap: Google opens its window right away.
  function connectGoogle(ids){
    const want = ids.filter(id => CONNECTORS[id]?.provider === "google" && states()[id]?.state !== "locked");
    if(!CFG.google?.clientId) return Promise.reject(new Error("Google sign-in isn't set up yet."));
    if(!googleReady()) return Promise.reject(new Error("Google sign-in is still loading. Tap again."));
    if(gWaiting) return Promise.reject(new Error("Google is already asking. Finish that window first."));
    const scopes = [...BASE.google, ...want.flatMap(id => CONNECTORS[id].scopes)];
    return new Promise((resolve, reject) => {
      gWaiting = { resolve, reject };
      gClient = scope.google.accounts.oauth2.initTokenClient({
        client_id: CFG.google.clientId, scope: scopes.join(" "), include_granted_scopes: true,
        callback: r => {
          const w = gWaiting; gWaiting = null;
          if(!r || r.error || !r.access_token){ w?.reject(new Error(r?.error === "access_denied" ? "You said no to Google. That's allowed." : "Google didn't connect. Try again.")); return; }
          tokens.google = { value:r.access_token, exp:Date.now() + (Number(r.expires_in) || 3600)*1000, scope:String(r.scope || scopes.join(" ")) };
          afterGoogle(want).then(w.resolve, w.reject);
        },
        error_callback: e => { const w = gWaiting; gWaiting = null; w?.reject(new Error(e?.type === "popup_closed" ? "The Google window closed before finishing." : "Google didn't connect. Try again.")); }
      });
      gClient.requestAccessToken({ prompt: "" });
    });
  }
  async function afterGoogle(want){
    const granted = want.filter(id => CONNECTORS[id].scopes.every(sc => tokens.google.scope.includes(sc)));
    granted.forEach(id => setState(id, "authorized"));
    if(granted.includes("gmail")) scope.JarvisGmail?.adopt?.(tokens.google.value, Math.round((tokens.google.exp - Date.now())/1000));
    const me = await api("google", "https://www.googleapis.com/oauth2/v3/userinfo");
    const email = String(me.email || "");
    const p = { provider:"google", name:String(me.given_name || me.name || "").slice(0, 40), fullName:String(me.name || "").slice(0, 80), email, admin:(CFG.adminEmailHashes || []).includes(await sha256(email)) };
    setProfile(keepNick(p));
    return { profile:p, granted, declined:want.filter(id => !granted.includes(id)) };
  }

  /* ---------- Microsoft (authorization code + PKCE, redirect) ---------- */
  const b64url = buf => scope.btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const randomText = n => b64url(scope.crypto.getRandomValues(new Uint8Array(n)));
  const redirectUri = () => scope.location.origin + scope.location.pathname;
  const msBase = () => `https://login.microsoftonline.com/${encodeURIComponent(CFG.microsoft?.tenant || "common")}/oauth2/v2.0`;
  // Leaves the page for Microsoft's sign-in. resume = where to continue when it comes back.
  async function connectMicrosoft(ids, resume = "connectors"){
    const want = ids.filter(id => CONNECTORS[id]?.provider === "microsoft" && states()[id]?.state !== "locked");
    if(!CFG.microsoft?.clientId) throw new Error("Microsoft sign-in isn't set up yet. Chris needs to finish that step.");
    const verifier = randomText(48), st = randomText(16);
    const challenge = b64url(await scope.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const scopes = [...BASE.microsoft, ...want.flatMap(id => CONNECTORS[id].scopes)];
    ss.set("ms.pkce", { verifier, state:st, want, scopes, resume, at:Date.now() });
    const q = new URLSearchParams({ client_id:CFG.microsoft.clientId, response_type:"code", redirect_uri:redirectUri(), response_mode:"query",
      scope:scopes.join(" "), code_challenge:challenge, code_challenge_method:"S256", state:st, prompt:"select_account" });
    scope.location.assign(`${msBase()}/authorize?${q}`);
    return new Promise(() => {});
  }
  // Call once on load. Returns null when the page wasn't opened by a Microsoft sign-in.
  async function handleRedirect(){
    const params = new URLSearchParams(scope.location.search);
    if(!params.has("code") && !params.has("error")) return null;
    const saved = ss.get("ms.pkce");
    const clean = () => { try { scope.history.replaceState(null, "", redirectUri() + scope.location.hash); } catch {} };
    if(!saved || params.get("state") !== saved.state){ clean(); return null; }
    ss.del("ms.pkce"); clean();
    if(params.has("error")) return { resume:saved.resume, error:params.get("error") === "access_denied" ? "You said no to Microsoft. That's allowed." : "Microsoft didn't connect. Try again.", granted:[], declined:saved.want };
    const body = new URLSearchParams({ client_id:CFG.microsoft.clientId, grant_type:"authorization_code", code:params.get("code"),
      redirect_uri:redirectUri(), code_verifier:saved.verifier, scope:saved.scopes.join(" ") });
    const r = await scope.fetch(`${msBase()}/token`, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body });
    const tok = await r.json().catch(() => ({}));
    if(!r.ok || !tok.access_token) return { resume:saved.resume, error:"Microsoft didn't connect. Try again.", granted:[], declined:saved.want };
    tokens.microsoft = { value:tok.access_token, exp:Date.now() + (Number(tok.expires_in) || 3600)*1000, scope:String(tok.scope || saved.scopes.join(" ")) };
    const granted = saved.want.filter(id => CONNECTORS[id].scopes.every(sc => tokens.microsoft.scope.toLowerCase().includes(sc.toLowerCase())));
    granted.forEach(id => setState(id, "authorized"));
    const me = await api("microsoft", "https://graph.microsoft.com/v1.0/me?$select=givenName,displayName,mail,userPrincipalName");
    const email = String(me.mail || me.userPrincipalName || "");
    const p = { provider:"microsoft", name:String(me.givenName || me.displayName || "").slice(0, 40), fullName:String(me.displayName || "").slice(0, 80), email, admin:(CFG.adminEmailHashes || []).includes(await sha256(email)) };
    setProfile(keepNick(p));
    return { resume:saved.resume, profile:p, granted, declined:saved.want.filter(id => !granted.includes(id)) };
  }

  /* ---------- calling Google or Microsoft with the user's token ---------- */
  async function call(p, url, { method = "GET", body, headers = {} } = {}){
    const tok = tokens[p];
    if(!live(tok)) throw new Error("Not connected in this session. Tap Reconnect.");
    const h = { Authorization:"Bearer " + tok.value, ...headers };
    if(body !== undefined && typeof body !== "string"){ h["Content-Type"] = "application/json"; body = JSON.stringify(body); }
    const r = await scope.fetch(url, { method, headers:h, body });
    if(r.status === 401){ tokens[p] = null; throw new Error("The connection expired. Tap Reconnect."); }
    if(r.status === 403) throw new Error("Permission missing for that. Check Connections.");
    if(!r.ok) throw new Error("The service answered " + r.status + ".");
    if(r.status === 202 || r.status === 204) return {};
    return r.json().catch(() => ({}));
  }
  const api = (p, url) => call(p, url);
  // The current access token, only for the ÓNIX server to confirm who is asking. Never stored.
  const idToken = () => { const p = provider(); return p && live(tokens[p]) ? { provider:p, token:tokens[p].value } : null; };
  // A short, real snapshot for the welcome. Each part is optional and never invented.
  async function snapshot(){
    const p = provider(), out = {};
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nowIso = new Date().toISOString();
    try {
      if(p === "google"){
        if(state("gmail") === "ready"){ const l = await api("google", "https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX"); out.unread = Number(l.messagesUnread) || 0; }
        if(state("gcal") === "ready"){ const e = await api("google", `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(nowIso)}`);
          const ev = e.items?.[0]; if(ev) out.next = { title:String(ev.summary || "a meeting").slice(0, 80), start:ev.start?.dateTime || ev.start?.date || "" }; }
        if(state("gdrive") === "ready"){ const f = await api("google", "https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id)&orderBy=modifiedTime%20desc"); out.files = (f.files || []).length; }
      } else if(p === "microsoft"){
        if(state("outlook") === "ready"){ const m = await api("microsoft", "https://graph.microsoft.com/v1.0/me/mailFolders/inbox?$select=unreadItemCount"); out.unread = Number(m.unreadItemCount) || 0; }
        if(state("mscal") === "ready"){ const e = await api("microsoft", `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(nowIso)}&endDateTime=${encodeURIComponent(new Date(Date.now() + 14*864e5).toISOString())}&$orderby=start/dateTime&$top=1&$select=subject,start`);
          const ev = e.value?.[0]; if(ev) out.next = { title:String(ev.subject || "a meeting").slice(0, 80), start:(ev.start?.dateTime || "") + (ev.start?.timeZone === "UTC" && !/Z$/.test(ev.start?.dateTime || "") ? "Z" : "") }; }
        if(state("onedrive") === "ready"){ const f = await api("microsoft", "https://graph.microsoft.com/v1.0/me/drive/recent?$top=50&$select=id"); out.files = (f.value || []).length; }
      }
    } catch {}
    out.tz = tz;
    return out;
  }
  function disconnect(id){
    const c = CONNECTORS[id]; if(!c) return;
    setState(id, "off");
    const left = ORDER[c.provider].some(x => states()[x]?.state === "authorized");
    if(!left && tokens[c.provider]){
      if(c.provider === "google") try { scope.google?.accounts?.oauth2?.revoke?.(tokens.google.value, () => {}); } catch {}
      tokens[c.provider] = null;
    }
    if(id === "gmail") scope.JarvisGmail?.forget?.();
  }
  function signOut(){
    ["google", "microsoft"].forEach(p => { if(p === "google" && tokens.google) try { scope.google?.accounts?.oauth2?.revoke?.(tokens.google.value, () => {}); } catch {} tokens[p] = null; });
    ["profile", "connectors", "onboarded", "requests", "log", "recon"].forEach(k => ls.del(k));
    scope.JarvisGmail?.forget?.();
  }

  /* ---------- requests for connectors that don't exist yet ---------- */
  const CATALOG = ["Procore", "Dropbox", "WhatsApp", "Slack", "CompanyCam", "QuickBooks", "Excel files", "iCloud"];
  const requests = () => ls.get("requests", []);
  function request(name){ const r = requests(); if(!r.includes(name)) { r.push(String(name).slice(0, 40)); ls.set("requests", r); } return r; }

  /* ---------- what ÓNIX did on the person's behalf (this phone only) ---------- */
  const logList = () => ls.get("log", []);
  function log(entry){ const l = logList(); l.unshift({ ...entry, at:new Date().toISOString() }); ls.set("log", l.slice(0, 50)); }

  /* ---------- premium voice budget for non-admins ---------- */
  const today = () => new Date().toISOString().slice(0, 10);
  const budget = {
    limit(){ return isAdmin() ? Infinity : Math.max(0, Number(CFG.voice?.guestDailySeconds ?? 120)); },
    used(){ const u = ls.get("voice", {}); return u.day === today() ? Number(u.s) || 0 : 0; },
    add(sec){ ls.set("voice", { day:today(), s:budget.used() + sec }); },
    left(){ return Math.max(0, budget.limit() - budget.used()); }
  };

  scope.OnixAccounts = Object.freeze({
    CONNECTORS, ORDER, CATALOG, profile, provider, isAdmin, callName, setNickname, state, lock, unlock, connectorsFor, onboarded, markOnboarded,
    loadGoogle, googleReady, connectGoogle, connectMicrosoft, handleRedirect, snapshot, disconnect, signOut, requests, request, budget, call, idToken, log, logList,
    microsoftReady: () => Boolean(CFG.microsoft?.clientId), sha256
  });
})(globalThis);
