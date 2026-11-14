/* Jarvis cinematic data explorer — all data remains in the owner's browser.
   A visual response is a browsable, paginated surface, not a five-card demo. */
(function (scope) {
  "use strict";
  let host = null, current = null, callbacks = {}, busy = false;
  const safe = value => String(value == null ? "" : value);
  const node = (tag, cls, content) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content != null) el.textContent = safe(content);
    return el;
  };
  const limit = n => Math.max(1, Math.min(10000, Number(n) || 20));
  function showDetail(item) {
    if (!host) return;
    const existing = host.querySelector(".explorer-detail");
    existing?.remove();
    const panel = node("div", "explorer-detail");
    panel.setAttribute("role","region");
    panel.setAttribute("aria-label","Detalle del registro");
    const bar = node("div", "explorer-detail-bar");
    const close = node("button","explorer-back","‹ Volver a los resultados");
    close.type = "button";
    close.addEventListener("click", () => panel.remove());
    bar.append(close);
    const body = node("div", "explorer-detail-body");
    body.append(node("span", "explorer-kind", item.tag || "DETALLE"));
    body.append(node("h3", "", item.title || "Registro"));
    if(item.subtitle) body.append(node("p", "explorer-detail-meta", item.subtitle));
    body.append(node("p", "explorer-detail-copy", item.body || item.detail || item.value || "Sin más información."));
    panel.append(bar, body);
    host.append(panel);
    close.focus();
  }
  function render(records, options = {}) {
    if (!records || !Array.isArray(records.items)) return reset();
    host = document.getElementById("dataExplorer");
    if (!host) return;
    callbacks = options;
    current = { ...records, items: records.items.map(x => ({ ...x })) };
    busy = false;
    host.textContent = "";
    host.hidden = false;
    const wrap = node("section", "explorer-shell");
    wrap.setAttribute("aria-label", records.title || "Resultados");
    const top = node("div", "explorer-top");
    const accent = node("span", "explorer-eyebrow", (records.kind === "gmail" ? "GMAIL / LIVE" : "JOBTREAD / LIVE") + " • CONSULTA VERIFICADA");
    const heading = node("div", "explorer-heading");
    heading.append(node("h2", "", records.title || "Resultados"));
    const count = node("span","explorer-count");
    const input = node("input", "explorer-search");
    input.type = "search"; input.placeholder = "Buscar en esta página…"; input.setAttribute("aria-label","Filtrar resultados cargados");
    const list = node("div","explorer-list"); list.setAttribute("role","list");
    const controls = node("div","explorer-controls");
    const load = node("button","explorer-load", "Cargar más resultados");
    load.type="button";
    const status = node("span","explorer-footnote");
    const footer = node("p","explorer-footnote","Solo lectura · Datos del servicio conectado · Voz resumida, detalles en pantalla");
    async function openEntry(item) {
      if (busy) return;
      const row = item;
      if (typeof callbacks.onOpen === "function") {
        try {
          const detail = await callbacks.onOpen(current, row);
          if (detail) showDetail(detail);
        } catch (e) { showDetail({ title: "No pude abrir el registro",
          body: safe(e.message || e).slice(0,250) }); }
      } else showDetail(item);
    }
    function paint() {
      const needle = input.value.trim().toLocaleLowerCase();
      const filtered = current.items.filter(x =>
        [x.title, x.subtitle, x.detail, x.tag].some(v => safe(v).toLocaleLowerCase().includes(needle)));
      list.textContent = "";
      const fragment = document.createDocumentFragment();
      // Each loaded page is limited to 50 records. A user can load more on demand.
      for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i];
        const row = node("button","explorer-row");
        row.type = "button"; row.setAttribute("role","listitem");
        row.style.setProperty("--entry-delay", Math.min(i, 9) * 45 + "ms");
        const icon = node("span","explorer-row-icon",
          current.kind === "gmail" ? "✉" : current.kind === "jobs" ? "▦" : "◇");
        icon.setAttribute("aria-hidden","true");
        const meta = node("span","explorer-row-body");
        meta.append(node("strong","explorer-row-title", item.title || item.value || "Sin nombre"));
        if(item.subtitle || item.value) meta.append(node("span","explorer-row-subtitle",item.subtitle || item.value));
        if(item.detail) meta.append(node("span","explorer-row-detail",item.detail));
        const end = node("span","explorer-row-arrow","›"); end.setAttribute("aria-hidden","true");
        row.append(icon,meta,end);
        row.addEventListener("click",()=>openEntry(item));
        fragment.append(row);
      }
      list.append(fragment);
      if (!filtered.length) list.append(node("div","explorer-empty","Sin coincidencias en los resultados cargados."));
      const total = current.total;
      const exact = Number.isInteger(total) && total >= 0;
      const suffix = exact ? " / " + total.toLocaleString("es-US") : "";
      count.textContent = current.items.length.toLocaleString("es-US") + suffix + " cargados";
      const hasMore = Boolean(current.nextPage);
      load.hidden = !hasMore; load.disabled = busy;
      status.textContent = busy ? "Consultando más registros…" :
        hasMore ? "Hay más registros disponibles" : exact
          ? "Fin de los resultados visibles" : "No hay más páginas disponibles";
    }
    load.addEventListener("click",async()=>{
      if (busy || !current?.nextPage || typeof callbacks.onMore !== "function") return;
      busy = true; paint(); load.disabled = true;
      try {
        const next = await callbacks.onMore(current);
        if (!next || !Array.isArray(next.items)) throw Error("La siguiente página no devolvió una lista válida.");
        const seen = new Set(current.items.map(x => x.id).filter(Boolean));
        current.items.push(...next.items.filter(x => !x.id || !seen.has(x.id)));
        current.nextPage = next.nextPage || null;
        if(Number.isInteger(next.total)) current.total = next.total;
        paint();
      } catch(e) {
        status.textContent = "No pude cargar más: " + safe(e.message || e).slice(0,150);
      } finally { busy = false; load.disabled = false; }
    });
    input.addEventListener("input",paint);
    top.append(accent, heading, count, input);
    controls.append(load,status);
    wrap.append(top,list,controls,footer);
    host.append(wrap);
    paint();
  }
  function reset() {
    if (host) { host.textContent=""; host.hidden=true; }
    current=null; busy=false;
  }
  scope.JarvisExplorer = Object.freeze({ render, reset, showDetail,
    get loadedCount() {return current?.items?.length || 0;} });
})(globalThis);
