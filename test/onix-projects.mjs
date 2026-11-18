// ÓNIX projects: per-project access by email hash, only whitelisted repo files, real data from the repo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash, webcrypto } from "node:crypto";
const src = f => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const hash = s => createHash("sha256").update(s).digest("hex");
const fetched = [];
function world(profile){
  const store = new Map([["una.onix.profile", JSON.stringify(profile)]]);
  const w = { console, URLSearchParams, TextEncoder, Intl, setTimeout, Promise, Date, JSON, Math, Number, String, Array, Object, Boolean, Error, Map, Uint8Array, crypto:webcrypto,
    localStorage:{ getItem:k => store.get(k) ?? null, setItem:(k, v) => store.set(k, String(v)), removeItem:k => store.delete(k) }, sessionStorage:{ getItem:() => null, setItem(){}, removeItem(){} },
    location:{ origin:"https://x", pathname:"/", search:"" }, document:{ getElementById:() => null },
    ONIX_CONFIG:{ adminEmailHashes:[], projects:[
      { id:"5660", name:"5660 Collins", repo:"5660-collins-app", aliases:["collins"], people:[hash("tiana@bldg.com")] },
      { id:"barcelona", name:"Barcelona Gardens", repo:"Barcelona", aliases:["barcelona"], people:[] } ] },
    async fetch(url){ fetched.push(String(url));
      if(/permits\.json$/.test(url)) return { ok:true, json:async () => ({ updatedAt:"2026-11-10", approvalStatus:"draft", keyDates:[{ date:"2026-11-17", title:"Lighting violation hearing, 9:00 AM", ref:"BVE26000408" }], items:[{ scope:"Lighting", number:"BVE26000408", status:"Hearing", next:"Nov 17" }] }) };
      if(/stormwater\.html$/.test(url)) return { ok:true, text:async () => "...Class V temporary dewatering not applied for as of Oct 31, 2026..." };
      return { ok:false, status:404 }; } };
  w.globalThis = w; w.window = w; vm.createContext(w);
  vm.runInContext(src("onix-accounts.js"), w); vm.runInContext(src("onix-projects.js"), w);
  return w.OnixProjects;
}
// Tiana: only 5660
let P = world({ provider:"google", name:"Tiana", email:"Tiana@bldg.com" });
assert.deepEqual((await P.list()).map(p => p.id), ["5660"]);
const r = await P.read("Collins");
assert.equal(r.ok, true); assert.equal(r.scene, "tower"); assert.equal(r.key_dates[0].ref, "BVE26000408");
assert.match(r.source, /5660-collins-app\/data\/permits\.json/);
const d = await P.read("5660", "DERM plan");
assert.equal(d.scene, "derm"); assert.equal(d.class_v_permit, "Not applied for as of Oct 31, 2026");
const no = await P.read("Barcelona");
assert.equal(no.ok, false, "Tiana can't ask about Barcelona"); assert.deepEqual([...no.projects], ["5660 Collins"]);
// Doug: nothing
P = world({ provider:"google", name:"Doug", email:"doug@gmail.com" });
assert.deepEqual(await P.list(), []);
// Admin: everything
P = world({ provider:"google", name:"Chris", email:"chris@x.com", admin:true });
assert.equal((await P.list()).length, 2);
// Only whitelisted files, only from salcedocristhian, only read
assert.ok(fetched.every(u => /^https:\/\/raw\.githubusercontent\.com\/salcedocristhian\/(5660-collins-app|Barcelona)\/main\/(data\/permits\.json|stormwater\.html|data\/nv5-repair-marks\.json|README(_ES)?\.md)$/.test(u)), fetched.join("\n"));
console.log("✓ ÓNIX projects: per-project access by email hash, admin sees all, whitelisted GitHub files, real permit dates and DERM status");
