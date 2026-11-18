/* ÓNIX projects: reads Chris's project repos on GitHub (public, read-only) and turns them into scenes.
   Who can ask: admins see every project; anyone else only the projects whose `people` list has the SHA-256 of their email.
   Note: the repos are public, so this list decides what ÓNIX talks about, not who can open GitHub.
   Only the files listed in FILES are ever fetched. Nothing is written. */
(function (scope) {
  "use strict";
  const A = () => scope.OnixAccounts;
  const RAW = "https://raw.githubusercontent.com/salcedocristhian/";
  const FILES = {
    "5660-collins-app":          { permits:"data/permits.json", stormwater:"stormwater.html", readme:"README_ES.md" },
    "Barcelona":                 { marks:"data/nv5-repair-marks.json", readme:"README.md" },
    "Gorilla-Screens":           { readme:"README.md" },
    "19984-Kingfisher-Lane-App": { readme:"README.md" }
  };
  const cache = new Map();
  async function raw(repo, key, asJSON){
    const path = FILES[repo]?.[key]; if(!path) return null;
    const k = repo + "/" + path, hit = cache.get(k);
    if(hit && Date.now() - hit.at < 300000) return hit.v;
    const r = await scope.fetch(RAW + repo + "/main/" + path, { cache:"no-store" });
    if(!r.ok) return null;
    const v = asJSON ? await r.json().catch(() => null) : (await r.text()).slice(0, 400000);
    cache.set(k, { at:Date.now(), v }); return v;
  }
  let myHash = null;
  async function hash(){ const p = A()?.profile(); if(!p?.email) return ""; if(myHash?.email !== p.email) myHash = { email:p.email, h:await A().sha256(p.email) }; return myHash.h; }
  async function list(){
    const all = scope.ONIX_CONFIG?.projects || [];
    if(A()?.isAdmin()) return all;
    const h = await hash(); return h ? all.filter(p => (p.people || []).includes(h)) : [];
  }
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  async function find(name){
    const ps = await list(), q = norm(name);
    return ps.find(p => norm(p.id) === q) || ps.find(p => norm(p.name).includes(q) || q.includes(norm(p.id)) || (p.aliases || []).some(a => q.includes(norm(a)))) || null;
  }

  /* ---------- per project readers: compact, real, with their source ---------- */
  async function read5660(topic){
    const src = "github.com/salcedocristhian/5660-collins-app";
    if(/derm|storm|water|dewater|class v/i.test(topic)){
      const html = await raw("5660-collins-app", "stormwater", false) || "";
      const cv = html.match(/Class V temporary dewatering not applied for as of ([A-Za-z]+ \d{1,2}, \d{4})/);
      return { scene:"derm", source:src + "/stormwater.html",
        stages:["Raw sample (A)", "Strainer: catches debris", "Settling tank: solids drop out", "Filter bags: fine particles", "Carbon: only if DERM asks", "DERM valve: closed"],
        class_v_permit:cv ? `Not applied for as of ${cv[1]}` : "Status not found in the repo", discharge:"Nothing goes to Indian Creek while the valve is closed." };
    }
    const p = await raw("5660-collins-app", "permits", true);
    if(!p) throw new Error("I couldn't read the 5660 permits file on GitHub.");
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dates = (p.keyDates || []).map(d => ({ date:d.date, title:d.title, ref:d.ref, note:d.qualifier, upcoming:new Date(d.date + "T12:00:00") >= now }));
    return { scene:"tower", source:src + "/data/permits.json", updated:p.updatedAt, approval:p.approvalStatus, disclaimer:String(p.disclaimer || "").slice(0, 300),
      key_dates:dates, permits:(p.items || []).slice(0, 25).map(i => ({ scope:i.scope, number:i.number, status:i.status, next:i.next, note:String(i.note || "").slice(0, 200) })) };
  }
  async function readBarcelona(){
    const src = "github.com/salcedocristhian/Barcelona/data/nv5-repair-marks.json";
    let marks = await raw("Barcelona", "marks", true).catch(() => null);
    let from = src;
    if(!Array.isArray(marks?.marks || marks)){ const local = await scope.fetch("./public/model-barcelona.json").then(r => r.json()).catch(() => null); marks = local?.marks || []; from = "ÓNIX copy of " + src; }
    else marks = marks.marks || marks;
    const by = {}; marks.forEach(m => { const b = String(Array.isArray(m) ? m[0] : m.building || m.b || "?"); by[b] = (by[b] || 0) + 1; });
    return { scene:"site", source:from, total:marks.length, by_building:by };
  }
  async function readReadme(repo){
    const t = await raw(repo, "readme", false);
    if(!t) throw new Error("That repo has no README I can read.");
    return { scene:"list", source:`github.com/salcedocristhian/${repo}/README.md`, summary:t.replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").slice(0, 2500) };
  }
  async function read(project, topic = ""){
    const p = await find(project);
    if(!p) return { ok:false, error:"No project by that name that you have access to.", projects:(await list()).map(x => x.name) };
    const data = p.repo === "5660-collins-app" ? await read5660(topic) : p.repo === "Barcelona" ? await readBarcelona() : await readReadme(p.repo);
    return { ok:true, project:p.name, ...data };
  }

  // Scene models live in the app (built from the same repos).
  let models = null;
  async function loadModels(){
    if(models) return models;
    const [t, s] = await Promise.all([scope.fetch("./public/model-5660-collins.json").then(r => r.json()).catch(() => null), scope.fetch("./public/model-barcelona-site.json").then(r => r.json()).catch(() => null)]);
    models = { tower:t ? { fh:t.fh, shapes:Object.fromEntries(Object.entries(t.shapes).map(([k, v]) => [k, Array.isArray(v) ? v : v.pts])), floors:t.floors.map(f => [f.name, f.shape]) } : null, site:s ? { loops:s.loops, marks:s.marks } : null };
    return models;
  }
  scope.OnixProjects = Object.freeze({ list, find, read, loadModels, FILES });
})(globalThis);
