/* ÓNIX connections: see, connect, reconnect, disconnect and lock each account.
   Suggestions for connectors that don't exist yet are saved and travel to Chris
   inside the person's next conversation with ÓNIX (ElevenLabs history). */
(function (scope) {
  "use strict";
  const doc = scope.document;
  const A = () => scope.OnixAccounts;
  let sheet = null;
  const CHIP = { ready:"Connected", authorized:"Tap reconnect", off:"Not connected", locked:"Locked" };
  function el(tag, cls, text){ const e = doc.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }

  function open(message){
    close();
    sheet = el("div", "onx-sheet"); sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "onxConnTitle");
    const panel = el("div", "onx-sheet-panel");
    const head = el("div", "onx-sheet-head");
    const title = el("h2", "", "Connections"); title.id = "onxConnTitle";
    const x = el("button", "onx-x", "Close"); x.type = "button"; x.addEventListener("click", close);
    head.append(title, x);
    const status = el("p", "onx-sheet-status"); status.setAttribute("role", "status"); status.textContent = message || "";
    const list = el("div", "onx-rows"), sugg = el("div", "onx-sugg"), foot = el("div", "onx-sheet-foot");
    panel.append(head, status, list, sugg, foot); sheet.append(panel); doc.body.append(sheet);
    sheet.addEventListener("click", e => { if(e.target === sheet) close(); });
    doc.addEventListener("keydown", onKey);
    render(list, sugg, foot, status);
    x.focus({ preventScroll:true });
    if(A().provider() === "google") A().loadGoogle().catch(() => {});
  }
  function onKey(e){ if(e.key === "Escape") close(); }
  function close(){ if(!sheet) return; sheet.remove(); sheet = null; doc.removeEventListener("keydown", onKey); scope.dispatchEvent(new CustomEvent("onix:connections-changed")); }

  function render(list, sugg, foot, status){
    list.replaceChildren(); sugg.replaceChildren(); foot.replaceChildren();
    const p = A().profile(), prov = A().provider();
    if(!p){
      list.append(el("p", "onx-empty", "You're not signed in yet. Run the welcome again to connect your email."));
      const b = el("button", "onx-btn primary", "Start the welcome"); b.type = "button";
      b.addEventListener("click", () => { close(); scope.dispatchEvent(new CustomEvent("onix:restart-welcome")); });
      foot.append(b); return;
    }
    const who = el("p", "onx-who"); who.textContent = `${p.fullName || p.name} · ${p.email}`; list.append(who);
    const nf = el("form", "onx-row onx-nick");
    const nl = el("label", "onx-row-info"); nl.append(el("b", "", "ÓNIX calls you"));
    const ni = el("input", "onx-input"); ni.type = "text"; ni.maxLength = 24; ni.value = A().callName(); ni.setAttribute("autocapitalize", "words"); nl.append(ni);
    const ns = el("button", "onx-btn", "Save"); ns.type = "submit";
    nf.append(nl, ns);
    nf.addEventListener("submit", e => { e.preventDefault(); const n = A().setNickname(ni.value); ni.value = n; status.textContent = `Got it. I'll call you ${n}.`; scope.dispatchEvent(new CustomEvent("onix:connections-changed")); });
    list.append(nf);
    A().connectorsFor(prov).forEach(c => list.append(row(c, prov, status, () => render(list, sugg, foot, status))));
    if(A().isAdmin()){
      const jt = el("div", "onx-row");
      const info = el("div", "onx-row-info"); info.append(el("b", "", "JobTread"), el("span", "", "Admin only · set in Settings"));
      jt.append(info, el("span", "onx-chip", scope.localStorage?.getItem("una.k.jobtread") ? "Connected" : "Not connected"));
      list.append(jt);
    }
    const done = A().logList();
    if(done.length){ const h = el("h3", "", "What ÓNIX did for you"); const ul = el("ul", "onx-log");
      done.slice(0, 5).forEach(x => ul.append(el("li", "", `${new Date(x.at).toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })} · ${x.what}`)));
      sugg.append(h, ul); }
    sugg.append(el("h3", "", "Need something else?"), el("p", "onx-quiet", "Ask for a connection. Chris sees it the next time you talk to ÓNIX."));
    const chips = el("div", "onx-chips"), asked = A().requests();
    A().CATALOG.forEach(name => {
      const b = el("button", "onx-ask" + (asked.includes(name) ? " done" : ""), asked.includes(name) ? `${name} · asked` : name); b.type = "button";
      b.setAttribute("aria-pressed", String(asked.includes(name)));
      b.addEventListener("click", () => { A().request(name); b.classList.add("done"); b.textContent = `${name} · asked`; b.setAttribute("aria-pressed", "true"); status.textContent = `Noted. Chris will hear you want ${name}.`; });
      chips.append(b);
    });
    sugg.append(chips);
    let armed = false;
    const out = el("button", "onx-btn danger", "Sign out of ÓNIX"); out.type = "button";
    out.addEventListener("click", () => {
      if(!armed){ armed = true; out.textContent = "Tap again to sign out"; status.textContent = "Signing out disconnects every account on this phone."; return; }
      A().signOut(); close(); scope.dispatchEvent(new CustomEvent("onix:restart-welcome"));
    });
    foot.append(out);
  }
  function row(c, prov, status, rerender){
    const r = el("div", "onx-row");
    const info = el("div", "onx-row-info"); info.append(el("b", "", c.name), el("span", "", c.action ? "Reply to emails and answer invites. Asks you every time." : prov === "google" ? "Google" : "Microsoft"));
    const chip = el("span", "onx-chip " + c.state, CHIP[c.state] || c.state);
    const acts = el("div", "onx-row-acts");
    const btn = (label, cls, fn) => { const b = el("button", "onx-btn " + (cls || ""), label); b.type = "button"; b.addEventListener("click", fn); acts.append(b); return b; };
    const connect = ids => {
      status.textContent = prov === "google" ? "Checking with Google…" : "Opening Microsoft sign-in…";
      const p = prov === "google" ? A().connectGoogle(ids) : A().connectMicrosoft(ids, "connectors");
      p.then(v => { status.textContent = v.declined?.length ? "Connected, except what you left unchecked." : `${c.name} connected.`; rerender(); },
             e => { status.textContent = String(e?.message || e); rerender(); });
    };
    const sameProvider = () => A().connectorsFor(prov).filter(x => x.state === "authorized" || x.state === "ready" || x.id === c.id).map(x => x.id);
    if(c.state === "ready"){ btn("Disconnect", "", () => { A().disconnect(c.id); status.textContent = `${c.name} disconnected.`; rerender(); });
      btn("Lock", "", () => { A().disconnect(c.id); A().lock(c.id); status.textContent = `${c.name} locked. ÓNIX won't ask for it.`; rerender(); }); }
    else if(c.state === "authorized") btn("Reconnect", "primary", () => connect(sameProvider()));
    else if(c.state === "off") btn("Connect", "primary", () => connect(sameProvider()));
    else if(c.state === "locked") btn("Unlock", "", () => { A().unlock(c.id); status.textContent = `${c.name} unlocked. Connect it when you're ready.`; rerender(); });
    r.append(info, chip, acts);
    return r;
  }
  scope.OnixConnections = Object.freeze({ open, close, get open_(){ return Boolean(sheet); } });
})(globalThis);
