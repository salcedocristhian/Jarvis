/* Jarvis direct JobTread mode: fixed read-only Pave queries. No LLM or credentials embedded. */
(function (scope) {
  "use strict";
  const safe = v => String(v == null ? "" : v).trim();
  const norm = v => safe(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const capped = v => safe(v).slice(0, 220);
  const insight = (title, value, note, tag = "JOBTREAD · CONSULTA REAL") =>
    ({ type: "insight", title: capped(title), value: capped(value), note: capped(note), tag });
  const headline = text => ({ type: "headline", text: capped(text) });
  const finish = (speech, frames, jobId = null, records = null) => ({
    speech, frames: frames.slice(0, 6), project: jobId, sources: ["JobTread"],
    closer: "Datos consultados en JobTread. Solo lectura.",
    ...(records ? { records } : {})
  });
  const detail = (name, value) => ({ title: capped(name), value: capped(value) });
  const collection = (kind, title, items, total, nextPage, extra = {}) => ({
    kind, title, items, total, nextPage: nextPage || null, ...extra
  });
  const clampSize = (size, d = 30) => Math.min(50, Math.max(1, Number(size) || d));
  const nodes = obj => {
    if (!obj || !Array.isArray(obj.nodes)) throw new Error("JobTread no devolvió una lista de registros válida.");
    return obj.nodes;
  };
  async function listJobs(query, orgId, size = 40, nameContains = "", page = "") {
    if (!safe(orgId)) throw new Error("No se encontró la organización autorizada.");
    const options = { size: clampSize(size), sortBy: [{ field: "createdAt", order: "desc" }] };
    if (page) options.page = String(page).slice(0, 512);
    if (nameContains) options.where = ["name", "like", "%" + nameContains.replace(/[%_]/g, "").slice(0, 36) + "%"];
    const result = await query({ organization: { $: { id: orgId },
      jobs: { $: options,
        count: {}, nextPage: {}, nodes: { id: {}, name: {}, number: {}, status: {} } } } });
    const connection = result && result.organization && result.organization.jobs;
    const jobs = nodes(connection).filter(j => j && j.id && j.name);
    return { jobs, total: Number.isInteger(connection.count) ? connection.count : null, nextPage: connection.nextPage || null };
  }

  const recordJob = j => ({ id: safe(j.id), title: safe(j.name), subtitle: safe(j.number) || "Sin número",
    detail: safe(j.status) || "Estado no indicado", tag: "PROYECTO" });
  const recordTask = t => ({ id: safe(t.id), title: safe(t.name) || "Tarea sin nombre",
    subtitle: t.endDate ? "Vence: " + safe(t.endDate) : "Sin fecha de vencimiento",
    detail: typeof t.progress === "number" ? "Avance registrado: " + Math.round(t.progress * 100) + "%" :
      safe(t.description) || "Sin progreso indicado", tag: "TAREA" });
  const recordDocument = d => ({ id: safe(d.id), title: safe(d.fullName) || "Documento sin título",
    subtitle: safe(d.status) || "Estado no indicado",
    detail: [d.type, d.issueDate].filter(Boolean).join(" · ") || safe(d.description).slice(0,140), tag: "DOCUMENTO" });
  const recordDailyLog = l => ({ id: safe(l.id), title: safe(l.date) || "Registro de obra",
    subtitle: safe(l.notes).slice(0,150) || "Sin notas", detail: "", tag: "DAILY LOG" });
  const recordFile = a => ({ id: safe(a.id), title: safe(a.name) || "Archivo",
    subtitle: safe(a.type) || "Archivo de proyecto", detail: safe(a.description).slice(0,140), tag: "ARCHIVO" });
  const fieldsByKind = {
    tasks: { id: {}, name: {}, description: {}, endDate: {}, progress: {} },
    documents: { id: {}, fullName: {}, status: {}, type: {}, issueDate: {}, description: {} },
    dailyLogs: { id: {}, date: {}, notes: {} },
    files: { id: {}, name: {}, type: {}, description: {} }
  };
  const formatsByKind = { tasks: recordTask, documents: recordDocument, dailyLogs: recordDailyLog, files: recordFile };
  async function listJobItems(query, jobId, kind, size = 30, page = "", pendingOnly = false) {
    if (!safe(jobId) || !Object.hasOwn(fieldsByKind, kind)) throw new Error("Consulta de JobTread no autorizada.");
    const args = { size: clampSize(size), sortBy: [{ field: "createdAt", order: "desc" }] };
    if (page) args.page = String(page).slice(0, 512);
    if (kind === "tasks" && pendingOnly) args.where = ["progress", "!=", 1];
    if (kind === "documents" && pendingOnly) args.where = ["status", "in", ["pending", "draft"]];
    const data = await query({ job: { $: { id: jobId },
      [kind]: { $: args, count: {}, nextPage: {}, nodes: fieldsByKind[kind] } } });
    const response = data?.job?.[kind], items = nodes(response);
    return { items: items.map(formatsByKind[kind]), total: Number.isInteger(response.count) ? response.count : null,
      nextPage: response.nextPage || null };
  }
  async function moreRecords(recordState, { query, orgId } = {}) {
    if (!recordState || typeof query !== "function") throw new Error("No hay consulta autorizada.");
    if (!recordState.nextPage) return { items: [], nextPage: null };
    if (recordState.kind === "jobs") {
      const res = await listJobs(query, orgId, 30, recordState.search || "", recordState.nextPage);
      return { items: res.jobs.map(recordJob), nextPage: res.nextPage, total: res.total };
    }
    if (recordState.kind in fieldsByKind) {
      return listJobItems(query, recordState.jobId, recordState.kind, 30, recordState.nextPage, recordState.pendingOnly);
    }
    throw new Error("Tipo de consulta no permitido.");
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
    const docRequest = /document|factura|invoice|orden(?:es)?|aprobaci|bill|submittal|propuesta|proposal/i.test(q);
    const dailyRequest = /daily.?log|diario.?de.?obra|bitacora|registro.?diario|reporte.?diario/i.test(q);
    const filesRequest = /archivo|files|foto|photograph|adjunto|planos|plan/i.test(q);
    const pendingOnly = /pendient|pending|draft|borrador|sin terminar|abiert|open|incomplet/i.test(q);
    const taskRequest = !docRequest && !dailyRequest && !filesRequest && /tarea|pendient(?:e|es)|por vencer|vencid|to.?do|actividades|task|schedule|cronograma/i.test(q);
    const financialRequest = /presupuesto|budget|gasto|costo|saldo|pago|financiero|profit|invoice total|total de facturas/i.test(q);
    const { jobs, total, nextPage } = await listJobs(query, orgId, 30);
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
    if (financialRequest) {
      if (!selected) return { speech: "Necesito el nombre o número del proyecto para consultar sus cifras verificadas.",
        frames: [headline("Especifica un proyecto para revisar sus cifras.")], sources: [], project: null };
      const r = await query({ job: { $: { id: selected.id },
        name: {}, number: {}, projectedPrice: {}, projectedCost: {}, actualCost: {} } });
      const d = r?.job;
      if (!d) throw new Error("JobTread no entregó las cifras del proyecto.");
      const money = v => typeof v === "number" && Number.isFinite(v)
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v)
        : "No disponible";
      const items = [detail("Projected Price", money(d.projectedPrice)),
        detail("Projected Cost", money(d.projectedCost)), detail("Actual Cost", money(d.actualCost))];
      return finish("Estas son las cifras individuales que JobTread reporta para " + selected.name +
        ". Revisa las tarjetas para los valores exactos; no estoy calculando un saldo de contrato.",
        [headline("Cifras de JobTread · " + selected.name)], selected.id,
        collection("metrics", "Valores registrados · USD", items, items.length, null));
    }
    if (!selected) {
      if (terms.length) return {
        speech: "No pude identificar con certeza el proyecto " + terms.slice(0, 2).join(" ") + " en JobTread. Prueba con su nombre exacto o número.",
        frames: [headline("Proyecto no identificado · JobTread"),
          { type: "action", text: "Indica el nombre completo o el número del proyecto. No mostraré otros proyectos como si fueran el solicitado." },
          ...specificJobs.slice(0, 2).map(j => insight(j.name, j.number || "Sin número", "Posible coincidencia; no confirmada"))],
        project: null, sources: [], closer: "Sin coincidencia confirmada"
      };
      if (taskRequest || docRequest || dailyRequest || filesRequest) {
        return finish("Necesito el nombre del proyecto para consultar esa información. Aquí tienes proyectos disponibles.",
          [headline("Selecciona un proyecto · JobTread")], null,
          collection("jobs", "Proyectos recientes", jobs.map(recordJob), total, nextPage));
      }
      const totalText = total === null ? "Consulta de proyectos disponibles." :
        "La organización tiene " + total + " proyectos registrados.";
      return finish(totalText + " Mostraré " + jobs.length +
        " proyectos en esta página. Puedes buscar y cargar las siguientes páginas en pantalla.",
        [headline("Directorio de proyectos · JobTread"),
          ...(total === null ? [] : [{ type: "number", value: total, format: "count", label: "proyectos registrados" }])],
          null, collection("jobs", "Proyectos · JobTread", jobs.map(recordJob), total, nextPage));
    }
    const label = selected.name;
    if (taskRequest || docRequest || dailyRequest || filesRequest) {
      const kind = taskRequest ? "tasks" : docRequest ? "documents" : dailyRequest ? "dailyLogs" : "files";
      const data = await listJobItems(query, selected.id, kind, 30, "", pendingOnly);
      const labels = { tasks: "Tareas", documents: "Documentos", dailyLogs: "Registros diarios", files: "Archivos" };
      const plural = labels[kind];
      const countText = data.total === null ? "Recuperé " + data.items.length + " registros" :
        "Encontré " + data.total + " registros";
      const qualifier = pendingOnly && (kind === "tasks" || kind === "documents") ? " filtrados como pendientes o abiertos" : " sin filtrar por estado";
      return finish(countText + " en " + plural.toLowerCase() + " del proyecto " + label +
        qualifier + ". Puedes explorarlos y cargar más resultados en pantalla.",
        [headline(plural + " · " + label),
          ...(data.total === null ? [] : [{type:"number", value:data.total,format:"count",label:plural.toLowerCase()}])],
        selected.id, collection(kind, plural + " · " + label, data.items, data.total, data.nextPage,
          { jobId: selected.id, pendingOnly }));
    }
    // Accurate project overview. Never infer the absence of data from pending-only filters.
    const response = await query({ job: { $: { id: selected.id },
      name: {}, number: {}, description: {}, createdAt: {}, closedOn: {},
      tasks: { $: { size: 1 }, count: {} },
      documents: { $: { size: 1 }, count: {} },
      dailyLogs: { $: { size: 1 }, count: {} } } });
    const project = response?.job;
    if (!project) throw new Error("No se pudo recuperar la ficha del proyecto.");
    const t = project.tasks?.count, d = project.documents?.count, l = project.dailyLogs?.count;
    const items = [
      detail("Número", selected.number || "No registrado"),
      detail("Estado JobTread", selected.status || "No indicado"),
      detail("Descripción", safe(project.description).slice(0, 700) || "Sin descripción"),
      detail("Tareas registradas", Number.isInteger(t) ? String(t) : "No disponible"),
      detail("Documentos · todos los estados", Number.isInteger(d) ? String(d) : "No disponible"),
      detail("Registros diarios", Number.isInteger(l) ? String(l) : "No disponible"),
      detail("Fecha de creación", safe(project.createdAt) || "No indicada"),
      detail("Cerrado el", safe(project.closedOn) || "Proyecto sin fecha de cierre")
    ];
    return finish("Encontré " + label + " en JobTread. Estado registrado: " +
      (selected.status || "no indicado") + ". La ficha incluye tareas, documentos de todos los estados y registros diarios.",
      [headline(label + " · JobTread")], selected.id,
      collection("overview", "Ficha completa del proyecto", items, items.length, null));
  }
  scope.JarvisDirect = Object.freeze({ answer, listJobs, listJobItems, moreRecords, matchJob });
})(globalThis);
