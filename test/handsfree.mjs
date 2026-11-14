import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
assert.ok(html.includes('id="handsfreeToggle"'));
assert.ok(html.includes('id="handsfreeHint"'));
assert.ok(html.includes('aria-pressed="false"'));
assert.ok(html.includes('class="handsfree-dot"'));
assert.ok(html.includes("visibilitychange"));
assert.ok(html.includes('if (document.hidden && session)'));
assert.ok(html.includes('onConnect: () => {'));
assert.ok(html.includes('handsfreeSessionStarted = true'));
assert.ok(html.includes('handsfreeSessionStarted = false'));
assert.ok(!html.includes('addEventListener("load", startAgentVoice'));
const inline=html.slice(html.indexOf("/* Una — cliente. Sin dependencias. */"),html.lastIndexOf("</script>"));
new Function(inline);
const begin=inline.indexOf('let handsfreePreferred = store.get("handsfreeEnabled", "0") === "1";');
const end=inline.indexOf('const useAgentVoice =',begin);
assert.ok(begin>0 && end>begin);
const body=inline.slice(begin,end);
const logs=[], state=new Map([["handsfreeEnabled","0"]]);
const btn={dataset:{},disabled:false,attrs:{},click:null,
  setAttribute(k,v){this.attrs[k]=v},addEventListener(name,fn){if(name==="click")this.click=fn}};
const label={textContent:""},hint={textContent:""};
const agent={connected:false,connecting:false};
const doc={hidden:false,listener:null,addEventListener(name,fn){if(name==="visibilitychange")this.listener=fn}};
let stopCount=0,startCount=0;
const ctx={store:{get:(k,d)=>state.has(k)?state.get(k):d,set:(k,v)=>state.set(k,v)},
  agentClient:agent,document:doc,prefs:{voice:"agent"},
  $: id=>({ "#handsfreeToggle":btn,"#handsfreeLabel":label,"#handsfreeHint":hint, "#optVoice":{value:"agent"} })[id],
  async startAgentVoice(){startCount++;agent.connected=true;ctx.setStarted(true);ctx.updateControl()},
  async stopAgentVoice(){stopCount++;agent.connected=false;ctx.setStarted(false);ctx.updateControl()},
  setPhase:(phase,message)=>logs.push({phase,message}),String,Boolean};
vm.createContext(ctx);
vm.runInContext(body+"\nglobalThis.toggleControl = toggleHandsfree; globalThis.updateControl = renderHandsfree; globalThis.setStarted = x => { handsfreeSessionStarted = x; };",ctx);
assert.equal(label.textContent,"");
ctx.updateControl();
assert.equal(label.textContent,"Activar manos libres");
assert.equal(btn.attrs["aria-pressed"],"false");
await ctx.toggleControl();
assert.equal(state.get("handsfreeEnabled"),"1");
assert.equal(startCount,1);
assert.equal(btn.attrs["aria-pressed"],"true");
assert.equal(label.textContent,"Detener escucha");
assert.equal(hint.textContent.includes("Micrófono activo"),true);
doc.hidden=true;
doc.listener();
assert.equal(stopCount,1);
assert.equal(state.get("handsfreeEnabled"),"1");
doc.hidden=false;
doc.listener();
assert.equal(label.textContent,"Reanudar escucha");
assert.equal(logs.at(-1).message,"Escucha pausada · pulsa Reanudar");
await ctx.toggleControl();
assert.equal(startCount,2);
assert.equal(label.textContent,"Detener escucha");
await ctx.toggleControl();
assert.equal(stopCount,2);
assert.equal(state.get("handsfreeEnabled"),"0");
assert.equal(label.textContent,"Activar manos libres");
console.log("✓ Hands-free: user-initiated start, continuing session, visible status, pause on background, manual resume/stop");
