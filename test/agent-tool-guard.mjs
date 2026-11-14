import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const root=await readFile(new URL("../index.html",import.meta.url),"utf8");
const start=root.indexOf("let agentResponseSequence = 0, agentPendingRead = 0;");
const end=root.indexOf("function narrateVerifiedResult(",start);
assert.ok(start>=0 && end>start);
const helper=root.slice(start,end);
const called=[];
let pending=[];
const ctx={
  agentLastQuestion:"¿puedes revisar mi correo?",
  agentClient:{connected:true},
  stateEl:{textContent:""},
  setTimeout:(fn)=>{pending.push(fn);return pending.length},
  clearTimeout:(id)=>{},
  agentGmailRead:async ({question})=>called.push({tool:"gmail",question}),
  agentJobTreadRead:async ({question})=>called.push({tool:"jobtread",question}),
  String,Error,console
};
vm.createContext(ctx);
vm.runInContext(helper,ctx);
assert.equal(ctx.handleLeakedToolCode("tool_code\nprint(default_api.gmail_read(question='¿puedes revisar mi correo?'))"),true);
assert.equal(ctx.stateEl.textContent,"Consultando Gmail");
assert.equal(called.length,0);
pending.shift()();
assert.deepEqual(called,[{tool:"gmail",question:"¿puedes revisar mi correo?"}]);
ctx.agentLastQuestion="¿Qué hay de 5660 Collins?";
assert.equal(ctx.handleLeakedToolCode("tool_code\nprint(default_api.jobtread_read(question='5660'))"),true);
pending.shift()();
assert.deepEqual(called.at(-1),{tool:"jobtread",question:"¿Qué hay de 5660 Collins?"});
assert.equal(ctx.handleLeakedToolCode("Este es un mensaje normal"),false);
assert.equal(ctx.handleLeakedToolCode("tool_code\nprint(default_api.deleteEmail())"),false);
assert.equal(ctx.handleLeakedToolCode("tool_code\nprint(default_api.executeShell())"),false);
ctx.agentLastQuestion="No hagas consultas";
assert.equal(ctx.handleLeakedToolCode("tool_code\nprint(default_api.gmail_read(question='cambiar correo'))"),true);
ctx.noteRealToolCall(); // real structured tool wins; no duplicate
pending.shift()();
assert.equal(called.length,2);
console.log("✓ ElevenAgents leaked tool code suppressed; only read-only Gmail/JobTread dispatch, using actual user question");
