// Verify ElevenAgents browser bridge without a real key, mic or network.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const root = await readFile(new URL("../index.html", import.meta.url), "utf8");
const src = await readFile(new URL("../public/eleven-agent-client.js", import.meta.url), "utf8");
assert.ok(root.includes('<script src="./public/eleven-agent-client.js"></script>'));
assert.ok(root.includes('ElevenAgents · conversación (sin API Key)'));
assert.ok(root.includes('clientTools: { jobtread_read: agentJobTreadRead, gmail_read: agentGmailRead }'));
assert.ok(root.includes('if (useAgentVoice()) startAgentVoice(q); else turn(q);'));
assert.ok(root.includes('if (useAgentVoice()) { if (agentClient?.connected) return stopAgentVoice(); return startAgentVoice(); }'));
assert.ok(root.includes('if (!keys.jobtread) {'));
assert.ok(!src.includes("xi-api-key"));
assert.ok(!src.includes("JOBTREAD_GRANT_KEY"));
const scripts = [...root.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean);
for (const script of scripts) new Function(script);
new Function(src);
let tracksStopped = 0, ended = 0, transmitted = [];
const fakeStartOptions = [];
const fakeConversation = {
  sendUserMessage(x) { transmitted.push(x); },
  async endSession() { ended++; },
};
const modified = src.replace('import(SDK_URL)', 'Promise.resolve({ Conversation: { async startSession(opts) { fakeStartOptions.push(opts); return fakeConversation; } } })');
const ctx = {
  window: {}, navigator: { mediaDevices: {
    async getUserMedia(opts) {
      assert.deepEqual({ ...opts }, { audio: true });
      return { getTracks: () => [{ stop: () => tracksStopped++ }] };
    }
  }},
  console, Promise, String, Object, Error, fakeStartOptions, fakeConversation, setTimeout, clearTimeout
};
vm.runInNewContext(modified, ctx);
const voice = ctx.window.JarvisElevenAgent;
assert.equal(voice.id, "agent_9601m7c4t540fh6v6nadake0hsrp");
assert.equal(voice.connected, false);
const testClientTools = { jobtread_read: async ({question}) => ({ok:true,speech:question}) };
const session = await voice.start({clientTools:testClientTools});
assert.ok(session);
assert.equal(voice.connected, true);
assert.equal(tracksStopped, 1);
assert.equal(fakeStartOptions[0].connectionType, "websocket");
assert.equal(fakeStartOptions[0].agentId, voice.id);
assert.equal(typeof fakeStartOptions[0].clientTools.jobtread_read, "function");
assert.equal((await fakeStartOptions[0].clientTools.jobtread_read({question:"proyectos"})).speech,"proyectos");
assert.equal(voice.send("Hola Jarvis"),true);
assert.deepEqual(transmitted,["Hola Jarvis"]);
await voice.stop();
assert.equal(voice.connected,false);
assert.equal(ended,1);
console.log("✓ ElevenAgents without API key: browser bridge, microphone, client tool, send, shutdown");
