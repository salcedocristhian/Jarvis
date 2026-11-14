// Prueba de humo: levanta el servidor con fetch simulado y verifica la API.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const port = 5191;
const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "test", JOBTREAD_GRANT_KEY: "test", PINNED_JOBS: "J1|Uno,J2|Dos", ELEVENLABS_API_KEY: "", APP_PASSCODE: "" };
const srv = spawn(process.execPath, ["--import", "./test/mock-fetch.mjs", "server.js"], { env, stdio: "pipe" });
await new Promise(r => srv.stdout.on("data", d => String(d).includes("escuchando") && r()));
const base = `http://localhost:${port}`;
try {
  const st = await (await fetch(base + "/api/status")).json();
  assert.equal(st.claude, "connected"); assert.equal(st.outlook, "not_connected");
  const pr = await (await fetch(base + "/api/projects")).json();
  assert.equal(pr.length, 2); assert.equal(pr[0].openTasks, 3); assert.equal(pr[0].urgent, true);
  const out = await (await fetch(base + "/api/ask", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "¿Cómo va?" }] }) })).json();
  assert.equal(out.speech, "Todo bien."); assert.equal(out.frames[1].type, "number"); assert.deepEqual(out.sources, ["JobTread"]);
  const page = await fetch(base + "/"); assert.equal(page.status, 200);
  const trav = await fetch(base + "/..%2Fserver.js"); assert.notEqual(trav.status, 200);
  console.log("✓ status, proyectos, bucle de herramientas (incluye bloqueo de escritura), estáticos y path traversal");
} finally { srv.kill(); }
