/* Jarvis Master Hub V1 — public GitHub project navigator.
   Read-only by design: no access tokens, GitHub writes, embeds or source mutation. */
(function (root) {
  "use strict";
  const OWNER = "salcedocristhian";
  const PROJECTS = Object.freeze([
    Object.freeze({ id:"5660-collins-app", name:"5660 Collins", category:"Condominium · Operations", note:"Permisos, cronograma y avances" }),
    Object.freeze({ id:"Barcelona", name:"Barcelona Gardens", category:"Restoration · Engineering", note:"Modelo 3D, reparaciones y reportes" }),
    Object.freeze({ id:"Gorilla-Screens", name:"Gorilla Screens", category:"Product · 3D Studio", note:"Screen enclosures y materiales" }),
    Object.freeze({ id:"19984-Kingfisher-Lane-App", name:"Kingfisher Lane", category:"Construction · 3D", note:"Diseño, materiales y construcción" }),
    Object.freeze({ id:"Servpro", name:"SERVPRO Operations", category:"Operations · Concept", note:"Demostración de coordinación operativa" }),
    Object.freeze({ id:"Jarvis", name:"Jarvis", category:"Master Interface", note:"Interfaz principal y agente de voz" })
  ]);
  const KNOWN = new Set(PROJECTS.map(p => p.id));
  function allowed(id) { return typeof id === "string" && KNOWN.has(id); }
  function repoUrl(id) { return allowed(id) ? "https://github.com/" + OWNER + "/" + id : null; }
  function pagesUrl(id, hasPages) {
    return allowed(id) && hasPages === true ? "https://" + OWNER + ".github.io/" + id + "/" : null;
  }
  function normalize(id, raw) {
    if (!allowed(id) || !raw || raw.full_name !== OWNER + "/" + id || raw.private !== false)
      throw new Error("El repositorio público no pudo verificarse.");
    return Object.freeze({
      id, fullName:raw.full_name, branch:String(raw.default_branch || ""),
      pushedAt:typeof raw.pushed_at === "string" ? raw.pushed_at : null,
      hasPages:raw.has_pages === true, archived:raw.archived === true,
      repoUrl:repoUrl(id), appUrl:pagesUrl(id, raw.has_pages === true)
    });
  }
  async function load(id, fetcher) {
    if (!allowed(id)) throw new Error("Repositorio fuera del catálogo autorizado.");
    const send = fetcher || (root.fetch && root.fetch.bind(root));
    if (typeof send !== "function") throw new Error("No hay conexión disponible.");
    const url = "https://api.github.com/repos/" + OWNER + "/" + id;
    const response = await send(url, { headers:{ Accept:"application/vnd.github+json" }, cache:"no-store" });
    if (!response || !response.ok) {
      if (response && response.status === 403) throw new Error("GitHub limitó temporalmente las consultas públicas.");
      throw new Error("GitHub no confirmó el repositorio (HTTP " + (response?.status || "sin respuesta") + ").");
    }
    return normalize(id, await response.json());
  }
  const API = Object.freeze({ projects:PROJECTS, repoUrl, pagesUrl, normalize, load });
  root.JarvisMasterHub = API;
  if (typeof document === "undefined") return;

  function start() {
    const menu = document.getElementById("menu");
    const menuButton = document.getElementById("menuBtn");
    if (!menu || !menuButton || document.getElementById("masterHubDialog")) return;
    function element(tag, className, value) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (value !== undefined) node.textContent = String(value);
      return node;
    }
    function external(url, label, cls) {
      const a = element("a", cls, label);
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      return a;
    }
    const opener = element("button", "mh-entry");
    opener.type = "button";
    opener.setAttribute("aria-haspopup", "dialog");
    opener.setAttribute("aria-controls", "masterHubDialog");
    opener.append(element("span", "mh-entry-icon", "✧"));
    const titleBox = element("span", "mh-entry-text");
    titleBox.append(element("strong", "", "Master Hub"));
    titleBox.append(element("small", "", "Aplicaciones y repositorios de GitHub"));
    opener.append(titleBox, element("span", "mh-entry-arrow", "›"));
    menu.insertBefore(opener, menu.querySelector("h2") || menu.firstChild);

    const panel = element("dialog", "mh-sheet");
    panel.id = "masterHubDialog";
    panel.setAttribute("aria-label", "Jarvis Master Hub");
    const header = element("div", "mh-header");
    const heading = element("div", "mh-heading");
    heading.append(element("span", "mh-kicker", "JARVIS / MASTER HUB"));
    heading.append(element("h2", "", "Tus proyectos, un solo lugar."));
    heading.append(element("p", "", "Explora las aplicaciones y consulta su actividad pública. No modifica repositorios."));
    const close = element("button", "mh-close", "×");
    close.type = "button"; close.setAttribute("aria-label", "Cerrar Master Hub");
    header.append(heading, close);
    const tools = element("div", "mh-tools");
    const status = element("p", "mh-status", "Información pública de GitHub · sin autenticación.");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const refresh = element("button", "mh-refresh", "Actualizar");
    refresh.type = "button";
    tools.append(status, refresh);
    const grid = element("div", "mh-grid");
    panel.append(header, tools, grid);
    document.body.append(panel);

    const records = new Map();
    const cards = new Map();
    for (const project of PROJECTS) {
      const card = element("article", "mh-card");
      card.append(element("span", "mh-category", project.category));
      card.append(element("h3", "", project.name));
      card.append(element("p", "mh-note", project.note));
      const state = element("p", "mh-repo-status", "Sin verificar en esta sesión.");
      const actions = element("div", "mh-actions");
      actions.append(external(repoUrl(project.id), "Código en GitHub", "mh-link"));
      const appAnchor = external(pagesUrl(project.id, true), "Abrir aplicación", "mh-link mh-app-link");
      appAnchor.hidden = true;
      actions.append(appAnchor);
      card.append(state, actions);
      grid.append(card);
      cards.set(project.id, { state, appAnchor });
    }
    const since = iso => {
      if (!iso || Number.isNaN(Date.parse(iso))) return "Fecha de actualización no disponible.";
      return "Último cambio publicado: " + new Intl.DateTimeFormat("es", { day:"numeric", month:"short", year:"numeric" }).format(new Date(iso));
    };
    let lastRefresh = 0;
    let busy = false;
    async function update(force) {
      if (busy) return;
      if (!force && records.size === PROJECTS.length && Date.now() - lastRefresh < 180000) return;
      busy = true; refresh.disabled = true;
      status.textContent = "Consultando repositorios públicos…";
      let ok = 0;
      await Promise.all(PROJECTS.map(async project => {
        const card = cards.get(project.id);
        card.state.textContent = "Verificando GitHub…";
        card.appAnchor.hidden = true;
        try {
          const info = await load(project.id);
          records.set(project.id, info);
          card.state.textContent = (info.archived ? "Archivado. " : "Repositorio verificado. ") + since(info.pushedAt);
          card.appAnchor.hidden = !info.hasPages || project.id === "Jarvis";
          ok++;
        } catch (error) {
          records.delete(project.id);
          card.state.textContent = String(error.message || "No fue posible comprobar GitHub.");
        }
      }));
      lastRefresh = Date.now();
      busy = false; refresh.disabled = false;
      status.textContent = ok + " de " + PROJECTS.length + " repositorios comprobados. " +
        (ok < PROJECTS.length ? "Los enlaces al código siguen disponibles; no se inventaron estados." : "Solo lectura.");
    }
    opener.addEventListener("click", () => {
      if (menu.open) menu.close();
      if (!panel.open) panel.showModal();
      update(false);
    });
    close.addEventListener("click", () => panel.close());
    panel.addEventListener("click", event => { if (event.target === panel) panel.close(); });
    panel.addEventListener("close", () => { if (menuButton.isConnected) menuButton.focus(); });
    refresh.addEventListener("click", () => update(true));
    root.JarvisMasterHub = Object.freeze({ ...API, open:() => opener.click() });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})(typeof window === "undefined" ? globalThis : window);
