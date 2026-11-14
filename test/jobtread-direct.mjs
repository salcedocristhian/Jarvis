import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../public/jobtread-direct.js";
const direct = globalThis.JarvisDirect;
assert.equal(typeof direct.answer, "function");
const jobs = [
  { id: "J1", name: "5660 Collins Avenue", number: "MTD-5660", status: "approved" },
  { id: "J2", name: "Barcelona Gardens", number: "MTD-016", status: "active" }
];
const calls = [];
const query = async q => {
  calls.push(q);
  assert.equal(Object.keys(q).length,1);
  assert.ok(q.organization || q.job,"Read only - no mutations");
  if (q.organization?.jobs) {
    return { organization: { jobs: { count: 710, nextPage: "NEXT", nodes: jobs } } };
  }
  if (q.job?.tasks && q.job?.documents && q.job?.dailyLogs)
    return {job:{ name:"5660 Collins Avenue",number:"MTD-5660",description:"Repairs in progress",
      createdAt:"2026-01-02",closedOn:null,tasks:{count:9},documents:{count:14},dailyLogs:{count:6}}};
  if (q.job?.tasks) return { job: { tasks: { count: 3, nextPage:"NEXT-TASK", nodes: [
    {id:"T1", name:"Revisar aislamiento", endDate:"2026-11-17", progress:0.5 },
    {id:"T2", name:"Coordinar inspección", endDate:null, progress:0 }] } } };
  if (q.job?.documents) return { job: { documents: { count: 4, nextPage:"NEXT-DOC", nodes: [
    {id:"D1", fullName:"Factura aprobada", status:"approved", issueDate:"2026-11-11"},
    {id:"D2", fullName:"Propuesta borrador", status:"draft", issueDate:"2026-11-13"}
  ] } } };
  if (q.job?.dailyLogs) return { job: { dailyLogs: { count: 1, nodes: [
    {id:"L1",date:"2026-11-13",notes:"Containment instalado"} ] } } };
  if (q.job?.files) return {job:{files:{count:1,nodes:[{id:"F1",name:"Plano A.pdf",type:"pdf"}]}}};
  if (q.job?.projectedPrice !== undefined)
    return {job:{name:"5660 Collins Avenue",number:"MTD-5660",projectedPrice:120000,projectedCost:80000,actualCost:50000}};
  throw Error("Unexpected read query "+JSON.stringify(q).slice(0,300));
};
const opts={query,orgId:"ORG1"};
let r=await direct.answer("Muéstrame mis proyectos de JobTread",opts);
assert.equal(r.records.total,710);
assert.equal(r.records.items.length,2);
assert.equal(r.records.nextPage,"NEXT");
assert.deepEqual(r.sources,["JobTread"]);
assert.ok(!r.speech.includes("solo 4"));
const next=await direct.moreRecords(r.records,opts);
assert.equal(next.nextPage,"NEXT");
assert.ok(calls.at(-1).organization.jobs.$.page==="NEXT");
r=await direct.answer("¿Qué tareas pendientes hay en 5660 Collins?",opts);
assert.equal(r.project,"J1");
assert.equal(r.records.kind,"tasks");
assert.equal(r.records.total,3);
assert.ok(calls.at(-1).job.tasks.$.where);
r=await direct.answer("Muéstrame todos los documentos de Barcelona",opts);
assert.equal(r.project,"J2");
assert.equal(r.records.kind,"documents");
assert.equal(r.records.total,4);
assert.ok(r.records.items.some(x=>x.subtitle==="approved"));
assert.equal(calls.at(-1).job.documents.$.where,undefined);
r=await direct.answer("¿Qué documentos pendientes hay en Barcelona?",opts);
assert.ok(calls.at(-1).job.documents.$.where);
r=await direct.answer("¿Hay registros diarios de 5660?",opts);
assert.equal(r.records.kind,"dailyLogs");
r=await direct.answer("Muéstrame los archivos del proyecto 5660",opts);
assert.equal(r.records.kind,"files");
r=await direct.answer("¿Cómo va 5660 Collins?",opts);
assert.equal(r.project,"J1");
assert.equal(r.records.kind,"overview");
assert.ok(r.records.items.some(x=>x.title==="Documentos · todos los estados"&&x.value==="14"));
r=await direct.answer("¿Cuál es el presupuesto de 5660 Collins?",opts);
assert.equal(r.records.kind,"metrics");
assert.ok(r.records.items.some(x=>x.value.includes("120,000")));
assert.ok(calls.every(q=>!Object.keys(q).some(x=>/^(delete|create|update|send)/i.test(x))));
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
assert.ok(html.includes('src="./public/jobtread-direct.js"'));
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
for(const script of scripts)new Function(script);
console.log("✓ JobTread full read-only access: 710 count, pagination, projects, all statuses, tasks, docs, daily logs, files, source costs");
