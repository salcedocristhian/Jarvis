import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../public/master-hub.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/master-hub.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, URL }, { filename:'master-hub.js' });
const hub = win.JarvisMasterHub;

assert.equal(hub.projects.length, 6);
assert.equal(new Set(hub.projects.map(p => p.id)).size, hub.projects.length);
assert.equal(hub.repoUrl('Barcelona'), 'https://github.com/salcedocristhian/Barcelona');
assert.equal(hub.repoUrl('../someone/secret'), null);
assert.equal(hub.pagesUrl('Barcelona', false), null);
assert.equal(hub.pagesUrl('Barcelona', true), 'https://salcedocristhian.github.io/Barcelona/');
assert.equal(hub.pagesUrl('rogue', true), null);
let networkCalls = 0;
const fakeFetch = async (url, options) => {
  networkCalls++;
  assert.equal(url, 'https://api.github.com/repos/salcedocristhian/Barcelona');
  assert.equal(options.headers.Accept, 'application/vnd.github+json');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers.Authorization, undefined);
  return { ok:true, status:200, json:async()=>({
    full_name:'salcedocristhian/Barcelona', private:false, default_branch:'main',
    pushed_at:'2026-11-14T12:00:00Z', has_pages:true, archived:false
  }) };
};
const result = await hub.load('Barcelona', fakeFetch);
assert.equal(result.fullName, 'salcedocristhian/Barcelona');
assert.equal(result.appUrl, 'https://salcedocristhian.github.io/Barcelona/');
assert.equal(result.pushedAt, '2026-11-14T12:00:00Z');
await assert.rejects(hub.load('unlisted-private-repo', fakeFetch), /catálogo autorizado/);
assert.equal(networkCalls, 1, 'unlisted repo must not trigger a request');
assert.throws(() => hub.normalize('Barcelona', { full_name:'attacker/Barcelona', private:false }), /no pudo verificarse/);
assert.throws(() => hub.normalize('Barcelona', { full_name:'salcedocristhian/Barcelona', private:true }), /no pudo verificarse/);
await assert.rejects(hub.load('Barcelona', async()=>({ok:false,status:403})), /limitó temporalmente/);
await assert.rejects(hub.load('Barcelona', async()=>({ok:false,status:404})), /HTTP 404/);
assert.match(html, /public\/master-hub\.js/);
assert.match(html, /public\/master-hub\.css/);
assert.match(html, /id="orbCanvas"/);
assert.match(html, /id="menuBtn"/);
assert.match(html, /web_research: agentWebResearch/);
assert.doesNotMatch(code, /localStorage|sessionStorage|GEMINI_API_KEY|CLOUDFLARE_API_TOKEN|x-goog-api-key/);
assert.match(code, /textContent = String\(value\)/);
assert.match(css, /\.mh-sheet/);
console.log('✓ Master Hub: allowlisted public repos, safe links, no keys, network failure fallback, voice/orb retained');
