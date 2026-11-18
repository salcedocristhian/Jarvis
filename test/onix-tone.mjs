import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const main = file("index.html");
const onboarding = file("public/onix-onboarding.js");
const setup = file("SETUP-ONIX.md");

for (const source of [main, onboarding]) {
  assert.doesNotMatch(source, /Chris is cheap|Chris owes me|any complaints go to him/i,
    "do not blame or insult the owner in spoken UX");
}
assert.match(main, /Premium voice time has reached/, "limits should be explained clearly");
assert.match(main, /monthly allowance resets/, "monthly exhaustion should not promise voice tomorrow");
assert.match(onboarding, /Hi\. I'm Onix, your personal assistant\./);
assert.match(setup, /\*\*First message:\*\* dejar vacío/,
  "document the quiet-start agent setting so future setup does not reintroduce the greeting");
console.log("✓ ÓNIX tone: respectful budget messages, no owner jokes, quiet-start setup documented");
