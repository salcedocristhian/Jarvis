import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../cloudflare/jarvis-research.mjs';

const origin='https://salcedocristhian.github.io';
const url='https://jarvis-research.test/api/research';
const token='R'.repeat(48);
let providerCalls=0;
const originalFetch=globalThis.fetch;
const oldCrypto=globalThis.crypto;
const response={
  candidates:[{content:{parts:[{text:'La respuesta se fundamenta en fuentes públicas.'}]},
    groundingMetadata:{groundingChunks:[{web:{uri:'https://example.org/public',title:'Fuente pública'}},
      {web:{uri:'javascript:alert(1)',title:'Peligrosa'}},{web:{uri:'https://example.org/public',title:'Duplicada'}}]}}]
};
const env={ GEMINI_API_KEY:'secret-only-on-server',JARVIS_PILOT_TOKEN:token,
  AI_RATE_LIMIT:{limit: async ()=>({success:true})}};
const req=(question, options={})=>new Request(url,{
  method:options.method||'POST',headers:{Origin:options.origin??origin,
    'Content-Type':options.contentType??'application/json',Authorization:`Bearer ${options.token??token}`},
  body:options.method==='OPTIONS'?undefined:options.body??JSON.stringify({question})});
try {
  globalThis.fetch=async (where, options)=>{
    providerCalls++;
    assert.match(where,/^https:\/\/generativelanguage\.googleapis\.com\//);
    assert.equal(options.headers['x-goog-api-key'],'secret-only-on-server');
    const body=JSON.parse(options.body);
    assert.deepEqual(body.tools,[{google_search:{}}]);
    assert.doesNotMatch(JSON.stringify(body),/secret-only-on-server/);
    return Response.json(response);
  };
  let r=await worker.fetch(new Request('https://jarvis-research.test/health'),env);
  assert.equal(r.status,200);assert.equal((await r.json()).ready,true);
  r=await worker.fetch(req('¿Qué pasó hoy?',{origin:'https://attacker.example'}),env);
  assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
  r=await worker.fetch(req('¿Qué pasó hoy?',{token:'not-authorized-key-123456789012345'}),env);
  assert.equal(r.status,401);assert.equal(providerCalls,0);
  r=await worker.fetch(req('¿Qué pasó hoy?',{method:'OPTIONS'}),env);
  assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
  r=await worker.fetch(req('¿Qué pasó hoy?'),env);
  assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
  const body=await r.json();
  assert.equal(body.ok,true);assert.equal(body.grounded,true);assert.equal(body.sources.length,1);
  assert.equal(body.sources[0].url,'https://example.org/public');
  assert.doesNotMatch(JSON.stringify(body),/secret-only-on-server|R{48}/);
  r=await worker.fetch(req('Mis correos de Gmail inbox'),env); assert.equal(r.status,422);
  r=await worker.fetch(req('x'.repeat(700)),env); assert.equal(r.status,422);
  r=await worker.fetch(req('¿Qué pasó hoy?'),{...env,AI_RATE_LIMIT:{limit: async()=>({success:false})}});
  assert.equal(r.status,429);
  assert.equal(providerCalls,1);
  r=await worker.fetch(req('¿Qué pasó hoy?'),{...env,GEMINI_API_KEY:undefined});assert.equal(r.status,503);
  console.log('✓ Secure Cloudflare Gemini Search: authenticated, CORS, grounded sources, quotas, no leaked keys');
}finally {globalThis.fetch=originalFetch}

const code=fs.readFileSync(new URL('../public/web-research.js',import.meta.url),'utf8');
let callCount=0,lastRequest;
const fakeWindow={};
const sandbox={window:fakeWindow, URL, AbortController, setTimeout,clearTimeout,
  fetch: async (where,opt)=>{callCount++;lastRequest={where,opt};return Response.json({answer:'Test answer',sources:[
    {title:'Docs',url:'https://docs.example.com/'},{title:'JS',url:'javascript:alert(1)'}],grounded:true,model:'test'});}}
vm.runInNewContext(code,sandbox);
let out=await fakeWindow.JarvisWebResearch.search({question:'latest news'});
assert.equal(out.ok,false);assert.equal(callCount,0);
assert.throws(()=>fakeWindow.JarvisWebResearch.configure('too-short'));
fakeWindow.JarvisWebResearch.configure(token);
out=await fakeWindow.JarvisWebResearch.search({question:'latest news'});
assert.equal(out.ok,true);assert.equal(out.grounded,true);assert.equal(out.sources.length,1);
assert.equal(callCount,1);assert.equal(lastRequest.opt.headers.Authorization,`Bearer ${token}`);
fakeWindow.JarvisWebResearch.configure('');assert.equal(fakeWindow.JarvisWebResearch.configured,false);
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/web_research: agentWebResearch/);
assert.match(html,/case "web-source"/);
assert.match(html,/public\/web-research\.js/);
assert.doesNotMatch(html,/x-goog-api-key/);
console.log('✓ Browser: opt-in memory-only access, safe URLs, agent routing and motion card');
