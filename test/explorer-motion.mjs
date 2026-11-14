import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const root=await readFile(new URL("../index.html",import.meta.url),"utf8");
const script=await readFile(new URL("../public/jarvis-explorer.js",import.meta.url),"utf8");
const css=await readFile(new URL("../public/jarvis-explorer.css",import.meta.url),"utf8");
assert.ok(root.includes('id="dataExplorer"'));
assert.ok(root.includes('src="./public/jarvis-explorer.js"'));
assert.ok(root.includes('href="./public/jarvis-explorer.css"'));
assert.ok(root.includes('window.JarvisExplorer?.render(out.records'));
assert.ok(root.includes('gmailClient.readMessage(item.id)'));
assert.ok(root.includes('globalThis.JarvisDirect.moreRecords(state'));
assert.ok(css.includes("prefers-reduced-motion:reduce"));
assert.ok(css.includes(".reel[data-voice=\"speaking\"]"));
assert.ok(css.includes("@media(max-height:720px)"));
new Function(script);
class Element {
  constructor(tag="div"){this.tagName=tag;this.children=[];this.handlers={};this.attrs={};
    this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.value="";
    this.className="";this.type="";this.disabled=false;}
  set textContent(v){this.children=[];this.text=safe(v)}
  get textContent(){return this.text??""}
  append(...els){this.children.push(...els)}
  setAttribute(k,v){this.attrs[k]=v}
  addEventListener(name,fn){this.handlers[name]=fn}
  querySelector(s){return null}
  remove(){}
}
const safe=v=>String(v??"");
const host=new Element("section");
const context={console,Promise,Boolean,String,Number,Set,
  document:{
    getElementById(id){assert.equal(id,"dataExplorer");return host;},
    createElement(tag){return new Element(tag)},
    createDocumentFragment(){return new Element("fragment")}
  }
};
vm.runInNewContext(script,context);
const viewer=context.JarvisExplorer;
const records={kind:"gmail",title:"Mi bandeja",total:45,nextPage:"p2",
  items:[{id:"m01",title:"Reporte A",subtitle:"test@example.com",detail:"No leído"}]};
let moreCalled=0,openCalled=0;
viewer.render(records,{onMore:async state=>{
  moreCalled++;assert.equal(state.nextPage,"p2");
  return {items:[{id:"m02",title:"Reporte B",subtitle:"user@example.com"}],nextPage:null,total:2};
},onOpen:async()=>{openCalled++;return null;}});
assert.equal(host.hidden,false);
assert.equal(viewer.loadedCount,1);
function findChild(el,cls){if(el.className===cls)return el;for(const child of el.children||[]){const r=findChild(child,cls);if(r)return r;}return null}
const button=findChild(host,"explorer-load");
assert.ok(button);
await button.handlers.click();
assert.equal(moreCalled,1);
assert.equal(viewer.loadedCount,2);
assert.equal(button.hidden,true);
assert.equal(findChild(host,"explorer-count").textContent,"2 / 2 cargados");
const row=findChild(host,"explorer-row");
await row.handlers.click();
assert.equal(openCalled,1);
viewer.reset();
assert.equal(host.hidden,true);
console.log("✓ Motion UX: mobile screen, 2-page searchable record explorer, safe DOM, open detail, reduced motion and voice sync");
