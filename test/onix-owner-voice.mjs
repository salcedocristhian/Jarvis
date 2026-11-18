// Regression checks for owner access, a quiet orb, and a spoken reconnect.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const settings = { window:{} };
vm.runInNewContext(source("public/onix-config.js"), settings);
const config = settings.window.ONIX_CONFIG;

assert.ok(config.adminEmailHashes.includes("192415de7da4a638b541cfd10a9ae75cd79a2d52463f27ee4bfa0629cb4565f2"), "existing owner authorization stays intact");
assert.ok(config.adminEmailHashes.includes("27fba9e0eb60ca1e4d5e58362271243c9597f8aa7273a68a1ad9f554faa47472"), "the signed-in owner's identifier is authorized");
assert.equal(config.voice.guestDailySeconds, 60, "guest allowance stays unchanged");
assert.equal(config.worker.url, "", "the test must not silently configure production infrastructure");

const html = source("index.html");
const onboarding = source("public/onix-onboarding.js");
assert.match(html, /greet:\s*false/g, "the old time-of-day orb greeting is disabled");
for(const phrase of ["Chris is cheap", "Chris owes me", "complaints go to him"]){
  assert.doesNotMatch(html + onboarding, new RegExp(phrase, "i"), `remove '${phrase}' from user-facing speech`);
}

// Returning users get one Connect button. The welcome audio and OAuth must both
// begin synchronously inside that button's tap for iPhone audio and Google popups.
const events = [];
let inTap = false, returnedProfile = null;
const profile = { name:"Chris", email:"owner@example.test", provider:"google" };
const host = {
  setAttribute(){}, append(){}, remove(){},
  addEventListener(event, callback){ if(event === "click") this.captureClick = callback; },
  animate(){ return { finished:Promise.resolve() }; }
};
const engine = {
  ease:k => k, become:async () => {}, tween:async () => {}, sleep:async () => {},
  say:async text => { events.push({ kind:"subtitle", text }); },
  clearSubs:async () => {}, destroy(){ events.push({ kind:"closed" }); },
  async confirmButton({ onTap, text }){
    assert.match(text, /Reconnect Google/);
    assert.equal(events.some(e => e.kind === "voice"), false, "welcome must not attempt audio before first tap");
    inTap = true;
    host.captureClick?.();
    const result = onTap();
    inTap = false;
    await result;
    return {ok:true, value:{profile}};
  }
};
const A = {
  profile:() => profile, provider:() => "google", callName:() => "Chris",
  connectorsFor:() => [{ id:"gmail", state:"authorized" },{ id:"gcal", state:"authorized" },{ id:"gdrive", state:"authorized" }],
  loadGoogle:async () => {},
  connectGoogle(ids){
    assert.equal(inTap, true, "Google popup starts inside the actual button tap");
    assert.deepEqual(Array.from(ids), ["gmail", "gcal", "gdrive"]);
    events.push({ kind:"oauth" });
    return Promise.resolve({profile});
  }
};
const w = {
  console, Promise, Date, setTimeout, clearTimeout,
  document:{ documentElement:{ dataset:{ motion:"normal" } }, body:{ append(){} }, createElement:() => host },
  OnixAccounts:A,
  OnixEngine:{ mount:() => engine },
  OnixVoice:{
    unlock(){ events.push({ kind:"unlock" }); }, stop(){},
    say(text){
      assert.equal(inTap, true, "welcome sound starts inside the button tap");
      events.push({ kind:"voice", text });
      return Promise.resolve();
    }
  }
};
w.globalThis = w;
vm.createContext(w);
vm.runInContext(onboarding, w);
assert.equal(await w.OnixOnboarding.reconnect({ onDone:p => { returnedProfile = p; } }), true);
assert.equal(returnedProfile, profile);
assert.match(events.find(e => e.kind === "voice")?.text || "", /^Welcome back, Chris\./);
assert.ok(events.findIndex(e => e.kind === "voice") < events.findIndex(e => e.kind === "oauth"), "speech begins before opening OAuth");
assert.equal(events.at(-1).kind, "closed");

console.log("onix-owner-voice ok");
