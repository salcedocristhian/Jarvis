/* Jarvis Motion Engine V2 — data-driven, screen-reader-safe motion scenes.
   No rendering of external content via innerHTML, no generated financial math.
   Decorations are conceptual; source records remain the source of truth below. */
(function (scope) {
  "use strict";
  let stage = null, last = null;
  const text = value => String(value == null ? "" : value);
  const make = (tag, cls, value) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = text(value);
    return el;
  };
  const div = (cls, value) => make("div",cls,value);
  const span = (cls, value) => make("span",cls,value);
  const sceneFor = kind => kind === "gmail" ? "gmail" : kind === "metrics" ? "budget" : "project";
  const count = records => {
    const value = Number.isInteger(records.total) && records.total >= 0 ? records.total : records.items.length;
    const label = Number.isInteger(records.total) && records.total >= 0
      ? (records.approximate ? "≈ " : "") + value.toLocaleString("en-US")
      : records.items.length.toLocaleString("en-US") + " en página";
    return label;
  };
  const decorate = (target, cls) => {
    const e=div(cls);e.setAttribute("aria-hidden","true");target.append(e);return e;
  };
  const marker = (title, content) => {
    const item=div("motion-data-mark");
    item.append(span("motion-data-mark-title",title), span("motion-data-mark-value",content));
    return item;
  };
  function render(records, actions = {}) {
    if(!records || !Array.isArray(records.items)) return reset();
    stage=document.getElementById("motionStage");
    if(!stage) return;
    const scene=sceneFor(records.kind);
    last={kind:scene,records};
    stage.textContent="";
    stage.hidden=false;
    stage.className="motion-stage motion-"+scene;
    stage.dataset.scene=scene;
    stage.setAttribute("role","region");
    stage.setAttribute("aria-label",scene==="gmail"?"Análisis visual de Gmail":
      scene==="budget"?"Visualización de cifras individuales":"Explorador visual de proyectos");
    const shell=div("motion-shell");
    const header=div("motion-topline");
    const name=span("motion-source",scene==="gmail"?"GMAIL · MESSAGE INTELLIGENCE":
      scene==="budget"?"JOBTREAD · FINANCIAL SIGNAL":"JOBTREAD · PROJECT INTELLIGENCE");
    const live=span("motion-verified","DATOS CONSULTADOS");
    header.append(name,live);
    const backdrop=div("motion-backdrop");
    decorate(backdrop,"motion-sweep");
    decorate(backdrop,"motion-particle-field");
    decorate(backdrop,"motion-orbit motion-orbit-a");
    decorate(backdrop,"motion-orbit motion-orbit-b");
    const sceneBody=div("motion-scene-body");
    const footer=div("motion-summary");
    footer.append(span("motion-counter",count(records)),
      span("motion-caption",scene==="gmail" ? "Mensajes encontrados · toca para leer" :
        scene==="budget" ? "Campos financieros independientes · sin saldos calculados" :
        records.kind==="jobs" ? "Proyectos consultados · explora cada uno" : "Registros del proyecto · solo lectura"));
    const actionButton=make("button","motion-inspect");
    actionButton.type="button";
    actionButton.textContent=scene==="gmail"?"Abrir primer correo ›":
      scene==="budget"?"Ver cifras exactas ›":"Explorar registros ›";
    actionButton.addEventListener("click",()=>{
      if(typeof actions.openFirst==="function") actions.openFirst();
      else document.querySelector("#dataExplorer .explorer-row")?.click();
    });
    function gmailScene(){
      const cluster=div("motion-mail-cluster");
      decorate(cluster,"motion-mail-shadow");
      for(let i=0;i<3;i++){
        const ghost=div("motion-mail-ghost motion-mail-ghost-"+i);
        ghost.setAttribute("aria-hidden","true");cluster.append(ghost);
      }
      const env=div("motion-envelope");
      decorate(env,"motion-envelope-back");
      decorate(env,"motion-envelope-paper");
      decorate(env,"motion-envelope-flap");
      decorate(env,"motion-envelope-light");
      const seal=span("motion-envelope-seal","✉");seal.setAttribute("aria-hidden","true");env.append(seal);
      cluster.append(env);
      const preview=div("motion-mail-preview");
      preview.append(span("motion-preview-label","MENSAJE DESTACADO"));
      const first=records.items[0];
      preview.append(span("motion-preview-title",first?.title||"No hay mensajes en esta búsqueda"));
      if(first?.subtitle) preview.append(span("motion-preview-by",first.subtitle));
      preview.append(span("motion-preview-foot",records.nextPage?"Hay más páginas":"Toca un mensaje para abrirlo"));
      sceneBody.append(cluster,preview);
    }
    function projectScene(){
      const field=div("motion-project-field");
      const holo=div("motion-holo");
      decorate(holo,"motion-holo-floor");
      const building=div("motion-building");
      // This is a symbolic generic wireframe, NOT an actual site reconstruction.
      for(let i=0;i<3;i++){
        const block=div("motion-building-block motion-building-block-"+i);
        for(let k=0;k<4;k++) decorate(block,"motion-building-level");
        building.append(block);
      }
      holo.append(building);
      decorate(holo,"motion-holo-laser");
      const side=div("motion-project-side");
      side.append(span("motion-preview-label",records.kind==="jobs"?"DIRECTORIO AUTORIZADO":"PROYECTO CONSULTADO"));
      const first=records.items[0];
      side.append(span("motion-project-name",records.kind==="jobs"?(first?.title||"Sin proyectos"):
        (records.title||"Información de proyecto")));
      side.append(span("motion-project-kind",records.kind==="jobs"?
        (first?.detail||"Selecciona un proyecto"):records.title));
      const nodes=div("motion-project-nodes");
      const items=records.items.slice(0,3);
      for (let i=0;i<items.length;i++){
        const title=records.kind==="overview" ? items[i].title : records.kind==="jobs" ?
          "Proyecto "+(i+1) : (items[i].tag||"REGISTRO");
        nodes.append(marker(title,records.kind==="overview"?items[i].value:items[i].title));
      }
      if(!items.length) nodes.append(marker("Estado","Sin registros en esta consulta"));
      side.append(nodes);
      field.append(holo,side);
      const caution=span("motion-project-caution","MODELO HOLOGRÁFICO CONCEPTUAL · NO ES UN PLANO DEL EDIFICIO");
      sceneBody.append(field,caution);
    }
    function budgetScene(){
      const container=div("motion-budget-field");
      const heading=div("motion-budget-heading");
      heading.append(span("motion-preview-label","VALORES INDIVIDUALES DE JOBTREAD"),
        span("motion-budget-alert","SIN CÁLCULOS INFERIDOS"));
      const flow=div("motion-budget-flow");
      const hub=div("motion-budget-hub");
      decorate(hub,"motion-budget-hub-ring");
      hub.append(span("motion-hub-label","JOBTREAD"),span("motion-hub-sublabel","Cifras registradas"));
      flow.append(hub);
      const lines=div("motion-budget-lines");
      for(let i=0;i<3;i++) decorate(lines,"motion-budget-line motion-budget-line-"+i);
      flow.append(lines);
      const fields=div("motion-budget-values");
      const expected=["Projected Price","Projected Cost","Actual Cost"];
      for(let i=0;i<3;i++){
        const item=records.items.find(x=>x.title===expected[i]);
        const block=div("motion-budget-value");
        block.append(span("motion-budget-label",expected[i]),
          span("motion-budget-amount",item?.value||"No disponible"));
        fields.append(block);
      }
      flow.append(fields);
      container.append(heading,flow);
      sceneBody.append(container);
    }
    if(scene==="gmail") gmailScene();
    else if(scene==="budget") budgetScene();
    else projectScene();
    shell.append(backdrop,header,sceneBody,footer,actionButton);
    stage.append(shell);
  }
  function reset(){
    if(stage){stage.textContent="";stage.hidden=true;stage.className="motion-stage";}
    last=null;
  }
  scope.JarvisMotion=Object.freeze({render,reset,sceneFor,
    get activeScene(){return last?.kind||null;}});
})(globalThis);
