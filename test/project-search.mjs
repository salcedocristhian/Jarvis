import assert from "node:assert/strict";
import "../public/jobtread-direct.js";
const direct=globalThis.JarvisDirect;
const recent=[{id:"other",name:"4400 Collins Place",number:"M1",status:"active"},
  {id:"unrelated",name:"Camelot Condominium",number:"M2",status:"active"}];
const matching=[{id:"target",name:"5660 Collins Avenue",number:"MTD-5660",status:"active"}];
const calls=[];
const q=async query=>{
  const jobs=query?.organization?.jobs;
  if(!jobs)throw Error("Only organization.jobs is allowed here");
  calls.push(jobs.$);
  if(jobs.$.where){const term=jobs.$.where[2];return {organization:{jobs:{
    count:1,nodes:term.includes("5660")?matching:[]
  }}};}
  return {organization:{jobs:{count:710,nodes:recent}}};
};
let r=await direct.answer("Háblame del proyecto de 5660 Collins Avenue", {query:q,orgId:"ORG"});
assert.equal(r.project,"target");
assert.ok(r.speech.includes("5660 Collins Avenue"));
assert.ok(calls.some(c=>c.where?.[2]==="%5660%"));
assert.ok(calls.every(c=>!c.where || c.where[0]==="name"));
calls.length=0;
r=await direct.answer("Muéstrame mis proyectos de JobTread",{query:q,orgId:"ORG"});
assert.equal(r.frames[1].value,710);
assert.equal(calls.length,1);
calls.length=0;
r=await direct.answer("Muéstrame el proyecto Boca Delrey Guardhouse",{query:q,orgId:"ORG"});
assert.equal(r.project,null);assert.deepEqual(r.sources,[]);
assert.ok(r.speech.includes("No pude identificar"));
assert.ok(!r.speech.includes("Camelot"));
console.log("✓ JobTread specific project search: validated 5660 match beyond recent results, no false fallback");
