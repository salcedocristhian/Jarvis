// ÓNIX uses the agent's ElevenLabs voice first; browser speech is a fallback only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/onix-voice.js", import.meta.url), "utf8");
const events = [];
let responseStatus = 200;
let requests = 0;

class FakeAudio {
  setAttribute(){}
  pause(){ events.push("audio:pause"); }
  load(){ setTimeout(() => this.onloadedmetadata?.(), 1); }
  get duration(){ return 0.02; }
  play(){
    events.push(this.src?.startsWith("blob:") ? "elevenlabs" : "unlock");
    if(this.src?.startsWith("blob:")) setTimeout(() => this.onended?.(), 1);
    return Promise.resolve();
  }
}
class Utterance { constructor(text){ this.text = text; } }
const synth = {
  getVoices:() => [], cancel(){},
  speak(u){ if(u.text.trim()) events.push("browser:" + u.text); setTimeout(() => u.onend?.(), 1); }
};
const config = { worker:{ url:"https://onix.test.workers.dev" }, voice:{ rate:1 } };
const mockURL = { createObjectURL:() => "blob:elevenlabs", revokeObjectURL(){} };
const scope = {
  Audio:FakeAudio, SpeechSynthesisUtterance:Utterance, speechSynthesis:synth,
  OnixAccounts:{ idToken:() => ({ provider:"google", token:"short-lived-test-token" }) },
  ONIX_CONFIG:config, localStorage:{ getItem:() => null, setItem(){} },
  Uint8Array, DataView, Promise, Date, URL:mockURL,
  setTimeout:(callback, delay) => setTimeout(callback, Math.min(delay, 25)), clearTimeout,
  btoa:text => Buffer.from(text, "binary").toString("base64"),
  fetch:async (url, options) => {
    assert.equal(url, config.worker.url + "/tts");
    assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ["provider", "text", "token"]);
    requests++;
    return new Response(responseStatus === 200 ? new Uint8Array([73, 68, 51, 3]) : "quota", {
      status:responseStatus, headers:{ "Content-Type":responseStatus === 200 ? "audio/mpeg" : "application/json" }
    });
  }
};
scope.globalThis = scope;
vm.runInNewContext(source, scope);
const voice = scope.OnixVoice;
const subtitles = [];
const show = (text, rate) => { subtitles.push({text, rate}); };

assert.equal(voice.ready(), true);
voice.unlock();
await voice.say("Welcome back, Chris", show);
assert.ok(events.includes("elevenlabs"), "first greeting uses ElevenLabs audio");
assert.equal(events.some(x => x.startsWith("browser:")), false, "no browser voice if premium voice succeeds");
assert.equal(requests, 1);

// A real credit/rate limit yields browser speech and avoids repeated failed requests.
responseStatus = 429;
await voice.say("You have unread email", show);
assert.ok(events.includes("browser:You have unread email"), "browser voice starts after 429");
assert.equal(requests, 2);
await voice.say("Tap the orb", show);
assert.ok(events.includes("browser:Tap the orb"), "browser remains the backup during quota cooldown");
assert.equal(requests, 2, "do not hit ElevenLabs repeatedly while quota is exhausted");
assert.deepEqual(subtitles.map(x => x.text), ["Welcome back, Chris", "You have unread email", "Tap the orb"]);

// If no Worker URL has been configured, fall back safely without sending any token.
config.worker.url = "";
await voice.say("No worker yet", show);
assert.ok(events.includes("browser:No worker yet"));
assert.equal(requests, 2);

console.log("onix-voice-fallback ok");
