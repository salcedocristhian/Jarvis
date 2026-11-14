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
  async function listJobs(query, orgId, size = 40, nameContains = "") {
    if (!safe(orgId)) throw new Error("No se encontró la organización autorizada.");
    const options = { size, sortBy: [{ field: "createdAt", order: "desc" }] };
    if (nameContains) options.where = ["name", "like", "%" + nameContains.replace(/[%_]/g, "").slice(0, 36) + "%"];
    const result = await query({ organization: { $: { id: orgId },
      jobs: { $: options,
        count: {}, nodes: { id: {}, name: {}, number: {}, status: {} } } } });
    const connection = result && result.organization && result.organization.jobs;
    const jobs = nodes(connection).filter(j => j && j.id && j.name);
    return { jobs, total: Number.isInteger(connection.count) ? connection.count : null };
  }
  const commonWords = new Set(["jobtread","proyecto","proyectos","project","projects","tareas","tarea","documentos","documento","pendientes","pendiente","hablame","dime","quiero","busca","muestrame","mostrame","sobre","desde","acerca","para","cual","como","del","con","los","las","una","que","and","the","with","mis","todo","todos","estados","estado","nombre","condo","condominium","avenue","apartments","hay","de","en","el","la","un","es","me","por","favor","in","status","job","thread"]);
  function projectTerms(question) {
    const q = norm(question);
    if (/\b(?:todos|ultimos|recientes|lista|listar|cuantos|resumen general)\b/.test(q) && !/\b\d{3,}\b/.test(q)) return [];
    const nums = q.match(/\b\d{3,}\b/g) || [];
    const words = q.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 4 && !commonWords.has(w) && !/^\d+$/.test(w));
    return [...new Set([...nums, ...words])].slice(0, 5);
  }
  function matchJob(question, jobs, preferredId) {
    const q = norm(question);
    const requiredNum = q.match(/\b\d{3,}\b/)?.[0];
    const searched = projectTerms(question);
    const matches = jobs.map(j => {
      const name = norm(j.name), number = norm(j.number);
      const terms = name.split(/[\s,._\-\/]+/).filter(s => s.length >= 4);
      let score = 0;
      if (name.length > 3 && q.includes(name)) score = 100 + name.length;
      if (number && number.length >= 3 && q.includes(number)) score = Math.max(score, 95);
      for (const word of searched) if (name.includes(word) || number.includes(word)) score += (word.length >= 4 ? 12 : 8);
      for (const t of terms) if (!["project","proyecto","condominium","construction","building","avenue","restoration","painting","the"].includes(t) && q.includes(t)) score = Math.max(score, 15 + t.length);
      if (requiredNum && !name.includes(requiredNum) && !number.includes(requiredNum)) score = 0;
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
    const docRequest = /document|factura|invoice|orden(?:es)?|aprobaci|bill|submittal/i.test(q);
    const taskRequest = !docRequest && /tarea|pendient(?:e|es)|por vencer|vencid|to.?do|actividades|task/i.test(q);
    const financialRequest = /presupuesto|budget|gasto|costo|saldo|pago|financiero|profit|invoice total|total de facturas/i.test(q);
    const { jobs, total } = await listJobs(query, orgId, 40);
    if (!jobs.length) return finish("La conexión respondió, pero no encontré proyectos disponibles con este Grant Key.",
      [headline("JobTread: sin proyectos visibles."), insight("Acceso", "Sin registros", "Verifica permisos del Grant Key y la organización.")]);
    // A recent-jobs sample is never proof that a named project does not exist.
    const terms = projectTerms(question);
    let specificJobs = jobs;
    let selected = matchJob(question, jobs, preferredJobId);
    if (!selected && terms.length) {
      // Server-side Pave 'like' search across ALL authorized jobs, not just newest 40.
      for (const term of terms.slice(0, 3)) {
        const found = await listJobs(query, orgId, 100, term);
        if (!found.jobs.length) continue;
        specificJobs = found.jobs;
        selected = matchJob(question, found.jobs, preferredJobId);
        if (selected) break;
      }
    }
    if (financialRequest) return {
      speech: "Para cifras financieras necesito una consulta específica y verificable. Este modo directo todavía no calcula presupuestos ni pagos.",
      frames: [headline("Consulta financiera no habilitada en modo directo."),
        { type: "action", text: "Puedes consultar proyectos, tareas abiertas o documentos pendientes sin Claude." }],
      sources: [], project: selected?.id || null, closer: "No voy a inventar cifras."
    };
    if (!selected) {
      if (terms.length) return {
        speech: "No pude identificar con certeza el proyecto " + terms.slice(0, 2).join(" ") + " en JobTread. Prueba con su nombre exacto o número.",
        frames: [headline("Proyecto no identificado · JobTread"),
          { type: "action", text: "Indica el nombre completo o el número del proyecto. No mostraré otros proyectos como si fueran el solicitado." },
          ...specificJobs.slice(0, 2).map(j => insight(j.name, j.number || "Sin número", "Posible coincidencia; no confirmada"))],
        project: null, sources: [], closer: "Sin coincidencia confirmada"
      };
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
