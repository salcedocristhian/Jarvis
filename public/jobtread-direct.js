/* Jarvis direct JobTread mode: fixed read-only Pave queries. No LLM or credentials embedded. */
(function (scope) {
  "use strict";
  const safe = v => String(v == null ? "" : v).trim();
  const norm = v => safe(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const capped = v => safe(v).slice(0, 220);
  const insight = (title, value, note, tag = "JOBTREAD · CONSULTA REAL") =>
    ({ type: "insight", title: capped(title), value: capped(value), note: capped(note), tag });
  const headline = text => ({ type: "headline", text: capped(text) });
  const finish = (speech, frames, jobId = null) => ({
    speech, frames: frames.slice(0, 6), project: jobId, sources: ["JobTread"],
    closer: "Datos consultados en JobTread. Solo lectura."
  });
  const nodes = obj => {
    if (!obj || !Array.isArray(obj.nodes)) throw new Error("JobTread no devolvió una lista de registros válida.");
    return obj.nodes;
  };
  async function listJobs(query, orgId, size = 40) {
    if (!safe(orgId)) throw new Error("No se encontró la organización autorizada.");
    const result = await query({ organization: { $: { id: orgId },
      jobs: { $: { size, sortBy: [{ field: "createdAt", order: "desc" }] },
        count: {}, nodes: { id: {}, name: {}, number: {}, status: {} } } } });
    const connection = result && result.organization && result.organization.jobs;
    const jobs = nodes(connection).filter(j => j && j.id && j.name);
    return { jobs, total: Number.isInteger(connection.count) ? connection.count : null };
  }
  function matchJob(question, jobs, preferredId) {
    const q = norm(question);
    const matches = jobs.map(j => {
      const name = norm(j.name), number = norm(j.number);
      const terms = name.split(/[\s,._\-\/]+/).filter(s => s.length >= 4);
      let score = 0;
      if (name.length > 3 && q.includes(name)) score = 100 + name.length;
      if (number && number.length >= 3 && q.includes(number)) score = Math.max(score, 95);
      for (const t of terms) if (!["project","proyecto","condominium","construction","building","avenue","restoration","painting","the"].includes(t) && q.includes(t)) score = Math.max(score, 15 + t.length);
      return { j, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    if (matches.length && (matches.length === 1 || matches[0].score > matches[1].score)) return matches[0].j;
    if (!matches.length && preferredId && /(?:este|esta|ese|esa|sus|su |del mismo|de ese|de este)/.test(q)) {
      return jobs.find(j => j.id === preferredId) || null;
    }
    return null;
  }
  async function answer(question, { query, orgId, preferredJobId = null } = {}) {
    if (typeof query !== "function") throw new Error("No hay una conexión de consulta configurada.");
    const q = norm(question);
    if (/^(hola|hey|hello|buenas|gracias|que puedes hacer)[\s?!.,]*$/.test(q)) {
      return { speech: "Puedo consultar en JobTread proyectos, tareas abiertas y documentos pendientes, sin Claude. Dime un proyecto o pide los proyectos recientes.",
        frames: [headline("JobTread conectado. Consultas reales sin Claude."),
          { type: "action", text: "Prueba: muéstrame mis proyectos de JobTread." }],
        sources: [], project: null, closer: "Solo lectura." };
    }
    const taskRequest = /tarea|pendient(?:e|es)|por vencer|vencid|to.?do|actividades|task/i.test(q);
    const docRequest = /document|factura|invoice|orden(?:es)?|aprobaci|bill|submittal/i.test(q);
    const financialRequest = /presupuesto|budget|gasto|costo|saldo|pago|financiero|profit|invoice total|total de facturas/i.test(q);
    const { jobs, total } = await listJobs(query, orgId, 40);
    if (!jobs.length) return finish("La conexión respondió, pero no encontré proyectos disponibles con este Grant Key.",
      [headline("JobTread: sin proyectos visibles."), insight("Acceso", "Sin registros", "Verifica permisos del Grant Key y la organización.")]);
    const selected = matchJob(question, jobs, preferredJobId);
    if (financialRequest) return {
      speech: "Para cifras financieras necesito una consulta específica y verificable. Este modo directo todavía no calcula presupuestos ni pagos.",
      frames: [headline("Consulta financiera no habilitada en modo directo."),
        { type: "action", text: "Puedes consultar proyectos, tareas abiertas o documentos pendientes sin Claude." }],
      sources: [], project: selected?.id || null, closer: "No voy a inventar cifras."
    };
    if (!selected) {
      if (taskRequest || docRequest) {
        return finish("Necesito el nombre del proyecto para consultar sus " + (taskRequest ? "tareas abiertas." : "documentos pendientes.") + " Te muestro algunos proyectos disponibles.",
          [headline("¿De cuál proyecto quieres consultar " + (taskRequest ? "tareas" : "documentos") + "?"),
            ...jobs.slice(0, 4).map(j => insight(j.name, j.number || "Sin número", j.status || "Estado no indicado"))]);
      }
      const shown = jobs.slice(0, 4);
      const totalText = total === null ? "Mostrando proyectos recientes." : ("La organización tiene " + total + " proyectos registrados.");
      return finish(totalText + " Estos son algunos de los que pude consultar: " + shown.map(j => j.name).join(", ") + ".",
        [headline("Proyectos de JobTread · datos reales."),
          ...(total === null ? [] : [{ type: "number", value: total, format: "count", label: "proyectos registrados en JobTread" }]),
          ...shown.map(j => insight(j.name, j.number || "Sin número", j.status || "Estado no indicado"))]);
    }
    const label = selected.name;
    if (taskRequest) {
      const response = await query({ job: { $: { id: selected.id }, name: {}, number: {},
        tasks: { $: { size: 15, where: ["progress", "!=", 1] },
          count: {}, nodes: { name: {}, endDate: {}, progress: {} } } } });
      const data = response?.job?.tasks, tasks = nodes(data), count = Number.isInteger(data.count) ? data.count : null;
      return finish((count === null ? "Encontré tareas abiertas" : "Encontré " + count + " tareas abiertas") +
        " en " + label + ". " + (tasks.length ? "La primera es " + safe(tasks[0].name) + "." : "No hay tareas en el resultado."),
        [headline("Tareas abiertas · " + label),
          ...(count === null ? [] : [{ type: "number", value: count, format: "count", label: "tareas abiertas" }]),
          ...tasks.slice(0, 4).map(t => insight(t.name || "Tarea sin nombre", t.endDate || "Sin fecha", "Fecha de vencimiento, si existe"))], selected.id);
    }
    if (docRequest) {
      const response = await query({ job: { $: { id: selected.id }, name: {},
        documents: { $: { size: 15, where: ["status", "in", ["pending", "draft"]] },
          count: {}, nodes: { fullName: {}, status: {}, issueDate: {} } } } });
      const data = response?.job?.documents, docs = nodes(data), count = Number.isInteger(data.count) ? data.count : null;
      return finish((count === null ? "Recuperé documentos pendientes" : "Encontré " + count + " documentos en estado pendiente o borrador") +
        " para " + label + ".",
        [headline("Documentos pendientes · " + label),
          ...(count === null ? [] : [{ type: "number", value: count, format: "count", label: "documentos pending/draft" }]),
          ...docs.slice(0, 4).map(d => insight(d.fullName || "Documento sin título", d.status || "Estado no informado", d.issueDate || "Sin fecha"))], selected.id);
    }
    // Project overview: use reliable list fields; an optional follow-up may get tasks.
    return finish("Encontré el proyecto " + label + " en JobTread. Su número es " + (selected.number || "no especificado") +
      " y su estado es " + (selected.status || "no informado") + ". Puedo revisar sus tareas o documentos pendientes.",
      [headline(label + " · JobTread"),
        insight("Número de proyecto", selected.number || "No indicado", "Registro consultado directamente en JobTread."),
        insight("Estado", selected.status || "No indicado", "El valor proviene de JobTread; no representa una revisión de campo."),
        { type: "action", text: "Pregunta: ¿qué tareas abiertas tiene este proyecto?" }], selected.id);
  }
  scope.JarvisDirect = Object.freeze({ answer, listJobs, matchJob });
})(globalThis);
