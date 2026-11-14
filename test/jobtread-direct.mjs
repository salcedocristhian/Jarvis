import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../public/jobtread-direct.js";
const direct = globalThis.JarvisDirect;
assert.equal(typeof direct.answer, "function");
const jobs = [
  { id: "J1", name: "5660 Collins Avenue", number: "MTD-5660", status: "active" },
  { id: "J2", name: "Barcelona Gardens", number: "MTD-016", status: "active" }
];
const calls = [];
const query = async q => {
  calls.push(q);
  const k = Object.keys(q);
  assert.deepEqual(k.length, 1);
  assert.ok(k[0] === "organization" || k[0] === "job", "Solo lectura: no mutaciones.");
  if (q.organization?.jobs) return { organization: { jobs: { count: 2, nodes: jobs } } };
  if (q.job?.tasks) return { job: { tasks: { count: 2, nodes: [
    { name: "Revisar aislamiento", endDate: "2026-11-17", progress: 0.5 },
    { name: "Coordinar inspección", endDate: null, progress: 0 }
  ] } } };
  if (q.job?.documents) return { job: { documents: { count: 1, nodes: [
    { fullName: "Factura pendiente", status: "pending", issueDate: "2026-11-11" }
  ] } } };
  throw new Error("Consulta inesperada");
};
const opts = { query, orgId: "ORG1" };
let r = await direct.answer("Muéstrame mis proyectos de JobTread", opts);
assert.equal(r.frames[1].value, 2);
assert.equal(r.frames[2].value, "MTD-5660");
assert.deepEqual(r.sources, ["JobTread"]);
r = await direct.answer("¿Qué tareas pendientes hay en 5660 Collins?", opts);
assert.equal(r.project, "J1");
assert.equal(r.frames[1].value, 2);
assert.ok(calls.some(q => q.job?.tasks));
r = await direct.answer("¿Qué documentos pendientes hay en Barcelona?", opts);
assert.equal(r.project, "J2");
assert.ok(calls.at(-1).job.documents);
assert.equal(r.frames[1].value, 1);
r = await direct.answer("¿Cómo va 5660 Collins?", opts);
assert.equal(r.project, "J1");
assert.ok(r.speech.includes("5660 Collins Avenue"));
r = await direct.answer("¿Cuál es el presupuesto de Barcelona?", opts);
assert.ok(r.speech.includes("todavía no"));
assert.deepEqual(r.sources, []);
r = await direct.answer("Hola", opts);
assert.deepEqual(r.sources, []);
await assert.rejects(direct.answer("proyectos", { query: async () => ({ organization: { jobs: {} } }), orgId: "ORG1" }), /lista/);
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.ok(html.includes('src="./public/jobtread-direct.js"'));
assert.ok(html.includes('keys.claude ? await askClaude() : await askJobTreadDirect(q)'));
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean);
for (const script of scripts) new Function(script);
console.log("✓ JobTread directo: proyectos, tareas, documentos, estado, sin cifras inventadas ni mutaciones");
