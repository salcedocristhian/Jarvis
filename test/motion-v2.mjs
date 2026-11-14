/* Contract tests for the shipped Motion V2 component.
   All external text must remain DOM text, and financial data cannot be invented. */
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const [js,css,html] = await Promise.all([
  readFile(new URL("../public/jarvis-motion.js",import.meta.url),"utf8"),
  readFile(new URL("../public/jarvis-motion.css",import.meta.url),"utf8"),
  readFile(new URL("../index.html",import.meta.url),"utf8")
]);
new Function(js);
assert.ok(html.includes('id="motionStage" hidden'));
assert.ok(html.includes('src="./public/jarvis-motion.js"'));
assert.ok(html.includes('href="./public/jarvis-motion.css"'));
assert.ok(html.includes('window.JarvisMotion.render(out.records'));
assert.ok(html.includes('reel.classList.toggle("with-motion", hasMotion)'));
assert.ok(css.includes(".motion-envelope-flap"));
assert.ok(css.includes(".motion-building"));
assert.ok(css.includes(".motion-budget-flow"));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.ok(css.includes('@media(max-width:375px)'));
assert.ok(css.includes('.reel[data-voice="speaking"] .motion-shell'));
assert.ok(!/\.innerHTML\s*=/.test(js));
assert.ok(!js.includes("eval("));
class Element {
  constructor(tag="div") {
    this.tagName=tag;this.className="";this.children=[];this.attrs={};this.handlers={};
    this.dataset={};this.hidden=false;this.text="";this.type="";
  }
  set textContent(v){this.children=[];this.text=String(v??"")}
  get textContent(){return this.text+this.children.map(x=>x.textContent).join("")}
  append(...c){this.children.push(...c)}
  setAttribute(k,v){this.attrs[k]=String(v)}
  addEventListener(e,fn){this.handlers[e]=fn}
  click(){this.handlers.click?.()}
}
const root=new Element("section");
let opened=0;
const ctx={
  Number,String,Object,Array,
  document:{
    getElementById(id){assert.equal(id,"motionStage");return root},
    querySelector(selector){assert.equal(selector,"#dataExplorer .explorer-row");return {click(){opened++}}},
    createElement(tag){return new Element(tag)}
  }
};
vm.runInNewContext(js,ctx);
const motion=ctx.JarvisMotion;
assert.equal(motion.sceneFor("gmail"),"gmail");
assert.equal(motion.sceneFor("metrics"),"budget");
assert.equal(motion.sceneFor("overview"),"project");
const find=(el,cls)=>el.className?.split(" ").includes(cls)?el:
  el.children.map(child=>find(child,cls)).find(Boolean)||null;
const msg="<img src=x onerror=alert('bad')>";
motion.render({kind:"gmail",title:"Bandeja",items:[{id:"m1",title:msg,subtitle:"Remitente A"},
 {id:"m2",title:"Factura del proveedor",subtitle:"Remitente B"}],
 total:73,approximate:true,nextPage:"next"},{openFirst(){opened++}});
assert.equal(motion.activeScene,"gmail");
assert.ok(root.textContent.includes(msg));
assert.ok(root.textContent.includes("≈ 73"));
assert.ok(find(root,"motion-envelope"));
assert.ok(find(root,"motion-envelope-paper"));
assert.equal(root.hidden,false);
find(root,"motion-inspect").click();
assert.equal(opened,1);
motion.render({kind:"jobs",title:"Proyectos",items:[{id:"J1",title:"5660 Collins",detail:"In Progress"}],
 total:710,nextPage:"next"});
assert.equal(motion.activeScene,"project");
assert.ok(root.textContent.includes("5660 Collins"));
assert.ok(root.textContent.includes("710"));
assert.ok(root.textContent.includes("MODELO HOLOGRÁFICO CONCEPTUAL"));
assert.ok(find(root,"motion-building"));
assert.equal(find(root,"motion-envelope"),null);
motion.render({kind:"overview",title:"Ficha del proyecto",items:[
 {title:"Estado JobTread",value:"Active"},{title:"Tareas",value:"9"}],total:2});
assert.equal(motion.activeScene,"project");
assert.ok(root.textContent.includes("Active"));
const amounts=["$425,321.00","No disponible","$73,500.00"];
motion.render({kind:"metrics",title:"Cifras exactas",items:[
 {title:"Projected Price",value:amounts[0]},
 {title:"Projected Cost",value:amounts[1]},
 {title:"Actual Cost",value:amounts[2]}
],total:3});
assert.equal(motion.activeScene,"budget");
assert.ok(find(root,"motion-budget-hub"));
assert.ok(find(root,"motion-budget-values"));
for(const value of amounts) assert.ok(root.textContent.includes(value));
assert.ok(root.textContent.includes("SIN CÁLCULOS INFERIDOS"));
assert.ok(root.textContent.includes("Campos financieros independientes"));
assert.ok(!root.textContent.includes("$351,821")); // no inferred remaining balance
motion.reset();assert.equal(motion.activeScene,null);assert.equal(root.hidden,true);
assert.equal(root.children.length,0);
console.log("✓ Motion Engine V2: distinct Gmail/JobTread/Budget scenes, safe source content, no inferred numbers, click, cleanup, responsive/reduced motion");
