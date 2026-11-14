// Precarga para pruebas: simula Claude y JobTread sin red ni llaves.
const real = globalThis.fetch;
let step = 0;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), json = b => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
  if (u.includes("api.jobtread.com")) {
    const q = JSON.parse(opts.body).query;
    if (q.currentGrant) return json({ currentGrant: { organization: { id: "ORG1", name: "Test" } } });
    if (q.createJob) return json({ error: "no debería llegar" });
    if (q.organization?.jobs) return json({ organization: { jobs: { count: 2, nodes: [
      { id: "J1", name: "5660 Collins Avenue", number: "MTD-5660", status: "active" },
      { id: "J2", name: "Barcelona Gardens", number: "MTD-016", status: "active" }
    ] } } });
    if (q.job?.documents) return json({ job: { documents: { count: 1, nodes: [
      { fullName: "CO-101", status: "pending", issueDate: "2026-11-12" }
    ] } } });
    if (q.job?.tasks && !q.job?.pending) return json({ job: { tasks: { count: 2, nodes: [
      { name: "Control de iluminación", progress: 0.5, endDate: "2026-11-17" },
      { name: "Inspección de pasillos", progress: 0, endDate: null }
    ] } } });
    return json({ job: { name: "TEST JOB", number: "T-1", status: "approved", tasks: { count: 3 }, pending: { count: 1 }, bills: { sum: 120.5 } } });
  }
  if (u.includes("api.anthropic.com")) {
    step++;
    if (step === 1) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "jobtread_query", input: { query: { job: { $: { id: "J1" }, name: {} } } } }, { type: "tool_use", id: "t2", name: "jobtread_query", input: { query: { createJob: {} } } }] });
    return json({ stop_reason: "end_turn", content: [{ type: "text", text: '```json\n{"speech":"Todo bien.","frames":[{"type":"headline","text":"Todo bien."},{"type":"number","value":120.5,"format":"usd","label":"por pagar"}],"closer":"Seco.","project":"J1"}\n```' }] });
  }
  return real(url, opts);
};
