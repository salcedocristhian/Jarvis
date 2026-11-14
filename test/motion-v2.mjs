/* Contract tests for Una Motion V3 (file name kept so the npm test script does not change).
   External text stays DOM text, numbers are never invented, real models are validated,
   and the ElevenAgents voice level is read-only. */
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const rd = p => readFile(new URL(p, import.meta.url), "utf8");
const [js, css, html, agentSrc, towerRaw, bcnRaw] = await Promise.all([
  rd("../public/jarvis-motion.js"), rd("../public/jarvis-motion.css"), rd("../index.html"),
  rd("../public/eleven-agent-client.js"), rd("../public/model-5660-collins.json"), rd("../public/model-barcelona.json")
]);
new Function(js);
// Wiring in the published app
assert.ok(html.includes('id="motionStage" hidden'));
assert.ok(html.includes('src="./public/jarvis-motion.js"'));
assert.ok(html.includes('href="./public/jarvis-motion.css"'));
assert.ok(html.includes('window.JarvisMotion.render(out.records'));
assert.ok(html.includes('reel.classList.toggle("with-motion", hasMotion)'));
assert.ok(html.includes('window.JarvisMotion?.init?.($("#bg"))'));
assert.ok(html.includes('window.JarvisMotion?.enterFrame?.(cur, reelFrames[reelIdx])'));
assert.ok(html.includes('window.JarvisMotion?.absorb?.()'));
assert.ok(html.includes('window.JarvisMotion?.phase?.(p, label)'));
assert.ok(html.includes('window.JarvisMotion?.voice?.(voiceLevel'));
// Safety rules
assert.ok(!/\.innerHTML\s*=/.test(js));
assert.ok(!js.includes("eval("));
assert.ok(!js.includes("new Function"));
assert.ok(js.includes("https://raw.githubusercontent.com/salcedocristhian/"));
assert.ok(!/method\s*:\s*["'](POST|PUT|PATCH|DELETE)/i.test(js), "models are read-only");
assert.ok(css.includes("@media(prefers-reduced-motion:reduce)"));
assert.ok(css.includes('html[data-motion="calm"]'));
assert.ok(css.includes("@media(max-width:375px)"));
assert.ok(css.includes('.reel[data-voice="speaking"] .motion-shell'));

class Element {
  constructor(tag = "div") { this.tagName = tag; this.className = ""; this.children = []; this.attrs = {}; this.handlers = {};
    this.dataset = {}; this.hidden = false; this.text = ""; this.type = ""; this.style = {}; }
  set textContent(v) { this.children = []; this.text = String(v ?? ""); }
  get textContent() { return this.text + this.children.map(x => x.textContent).join(""); }
  append(...c) { this.children.push(...c); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(e, fn) { this.handlers[e] = fn; }
  click() { this.handlers.click?.(); }
}
const root = new Element("section");
let opened = 0;
const ctx = { Number, String, Object, Array, Math, Date, Promise, Boolean, JSON,
  document: {
    getElementById(id) { return id === "motionStage" ? root : null; },
    querySelector(sel) { assert.equal(sel, "#dataExplorer .explorer-row"); return { click() { opened++; } }; },
    createElement(tag) { return new Element(tag); },
    createTextNode(t) { const e = new Element("#text"); e.textContent = t; return e; }
  } };
vm.runInNewContext(js, ctx);
const motion = ctx.JarvisMotion;
const find = (el, cls) => el.className?.split(" ").includes(cls) ? el : el.children.map(c => find(c, cls)).find(Boolean) || null;
assert.equal(motion.sceneFor("gmail"), "gmail");
assert.equal(motion.sceneFor("metrics"), "budget");
assert.equal(motion.sceneFor("overview"), "project");
assert.equal(motion.init(null), false, "no canvas, no field");
// Gmail: subjects stay text, approximate totals, paper cards
const evil = "<img src=x onerror=alert('bad')>";
motion.render({ kind: "gmail", title: "Bandeja", items: [{ id: "m1", title: evil, subtitle: "Remitente A", tag: "GMAIL · NO LEÍDO" },
  { id: "m2", title: "Factura del proveedor", subtitle: "Remitente B" }], total: 73, approximate: true, nextPage: "next" }, { openFirst() { opened++; } });
assert.equal(motion.activeScene, "gmail");
assert.ok(root.textContent.includes(evil));
assert.ok(root.textContent.includes("≈ 73"));
assert.ok(find(root, "um-paper"));
assert.ok(find(root, "unread"));
assert.equal(root.hidden, false);
find(root, "motion-inspect").click();
assert.equal(opened, 1);
// Project list: constellation, no model claimed
motion.render({ kind: "jobs", title: "Proyectos", items: [{ id: "J1", title: "5660 Collins", detail: "In Progress" }], total: 710, nextPage: "next" });
assert.equal(motion.activeScene, "project");
assert.ok(root.textContent.includes("5660 Collins"));
assert.ok(root.textContent.includes("710"));
assert.ok(root.textContent.includes("Mapa de los proyectos consultados"));
assert.equal(motion.modelFor({ kind: "jobs", items: [{ title: "5660 Collins" }] }, {}), null);
assert.equal(motion.modelFor({ kind: "overview", title: "Ficha", items: [] }, { contextTitle: "5660 Collins avanza" }), "5660");
assert.equal(motion.modelFor({ kind: "tasks", title: "Tareas de Barcelona Gardens", items: [] }, {}), "barcelona");
assert.equal(motion.modelFor({ kind: "overview", title: "Ficha", items: [{ title: "Otro proyecto" }] }, {}), null);
// Overview of a project with a model: honest status while the model loads
motion.render({ kind: "overview", title: "Ficha del proyecto", items: [{ title: "Estado JobTread", value: "Active" }, { title: "Tareas", value: "9" }], total: 2 },
  { contextTitle: "5660 Collins" });
assert.ok(root.textContent.includes("Active"));
assert.ok(root.textContent.includes("Buscando el modelo 3D del proyecto"));
// Budget: exact strings, unavailable values stay unavailable, no computed totals
const amounts = ["$425,321.00", "No disponible", "$73,500.00"];
motion.render({ kind: "metrics", title: "Cifras exactas", items: [
  { title: "Projected Price", value: amounts[0] }, { title: "Actual Cost", value: amounts[2] }], total: 2 });
assert.equal(motion.activeScene, "budget");
for (const a of amounts) assert.ok(root.textContent.includes(a), a);
assert.ok(!root.textContent.includes("498,821"));
assert.ok(!root.textContent.includes("351,821"));
assert.ok(find(root, "um-terrain"));
motion.reset();
assert.equal(root.hidden, true);
assert.equal(motion.activeScene, null);
// Frame hooks are safe without a browser
motion.enterFrame(null, null); motion.leaveFrames(); motion.absorb(); motion.phase("thinking", "Consultando JobTread"); motion.phase("idle");
motion.voice(.5, null); assert.ok(motion.voiceState.level > 0);
// Real models: bundled copies are valid and honest
const tower = JSON.parse(towerRaw), bcn = JSON.parse(bcnRaw);
assert.ok(motion.validModel("5660", tower));
assert.equal(tower.floors.length, 21);
assert.ok(tower.floors.some(f => f.name === "Piso 12") && tower.floors.some(f => f.name === "Piso 14"));
assert.ok(!tower.floors.some(f => f.name === "Piso 13"), "5660 has no floor 13");
assert.ok(tower.source.includes("RELATS"));
assert.ok(motion.validModel("barcelona", bcn));
assert.ok(motion.validMarks(bcn.marks));
assert.equal(bcn.marks.length, 105);
assert.ok(!motion.validModel("5660", { fh: 1, shapes: {}, floors: [{ name: "x", shape: "nope" }] }));
assert.ok(!motion.validMarks([["100", "uno", "B", 1, 2]]));
// ElevenAgents voice level: read-only, clamped, never opens anything
const fakeConversation = { sendUserMessage() {}, async endSession() {}, getOutputVolume: () => 1.7, getOutputByteFrequencyData: () => new Uint8Array([10, 200]) };
const modified = agentSrc.replace("import(SDK_URL)", "Promise.resolve({ Conversation: { async startSession() { return fakeConversation; } } })");
const actx = { fakeConversation, window: {}, navigator: { mediaDevices: { async getUserMedia() { return { getTracks: () => [] }; } } }, console, Promise, String, Object, Error, Number, Math, setTimeout, clearTimeout };
vm.runInNewContext(modified, actx);
const agent = actx.window.JarvisElevenAgent;
assert.equal(agent.level(), 0);
assert.equal(agent.bands(), null);
await agent.start({});
assert.equal(agent.level(), 1);
assert.equal(agent.bands().length, 2);
await agent.stop();
assert.equal(agent.level(), 0);
console.log("✓ Motion V3: particle field, per-frame physics, Gmail paper, budget terrain, real 5660/Barcelona models read-only, safe text, voice level");
