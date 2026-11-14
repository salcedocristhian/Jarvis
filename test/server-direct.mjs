import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const port = 5192;
const env = { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: "",
  JOBTREAD_GRANT_KEY: "test", PINNED_JOBS: "", ELEVENLABS_API_KEY: "", APP_PASSCODE: "" };
const srv = spawn(process.execPath, ["--import", "./test/mock-fetch.mjs", "server.js"],
  { env, stdio: "pipe" });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("El servidor no arrancó")), 7000);
    srv.stdout.on("data", data => {
      if (String(data).includes("escuchando")) { clearTimeout(timeout); resolve(); }
    });
    srv.once("exit", code => { clearTimeout(timeout); reject(new Error("Salida anticipada: " + code)); });
  });
  const base = "http://127.0.0.1:" + port;
  const status = await (await fetch(base + "/api/status")).json();
  assert.equal(status.claude, "not_connected");
  assert.equal(status.jobtread, "connected");
  const projects = await (await fetch(base + "/api/projects")).json();
  assert.equal(projects.length, 2);
  assert.equal(projects[0].label, "5660 Collins Avenue");
  const send = async q => (await (await fetch(base + "/api/ask", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: q }] })
  })).json());
  const list = await send("Muéstrame mis proyectos de JobTread");
  assert.equal(list.frames[1].value, 2);
  const tasks = await send("¿Qué tareas tiene 5660 Collins?");
  assert.equal(tasks.project, "J1");
  assert.equal(tasks.frames[1].value, 2);
  const docs = await send("Documentos pendientes de Barcelona");
  assert.equal(docs.project, "J2");
  assert.equal(docs.frames[1].value, 1);
  console.log("✓ Servidor sin Claude: proyectos, tareas, documentos y fuentes JobTread");
} finally { srv.kill(); }
