/* Una Motion V3: the background mesh writes the answers.
   - Field: the terrain mesh plus suspended dust. Headlines are built from those particles.
   - Each frame type has its own physics: particles (headline), terrain (number), laser plotter
     (evidence and sources), paper with gravity (Gmail), mechanical assembly (action).
   - Mandala while thinking, orb ring driven by the real ElevenAgents output volume.
   - Real 3D models read-only from salcedocristhian repos (5660-collins-app, Barcelona), with a
     bundled copy as fallback. Nothing is ever written to those repos.
   Rules kept from V2: external text only via textContent, no innerHTML, no eval, no invented numbers. */
(function (scope) {
  "use strict";
  const doc = scope.document;
  const RMQ = typeof scope.matchMedia === "function" ? scope.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const calm = () => Boolean((RMQ && RMQ.matches) || doc?.documentElement?.dataset?.motion === "calm");
  const T = ms => calm() ? 0 : ms;
  const now = () => (scope.performance && typeof scope.performance.now === "function") ? scope.performance.now() : Date.now();
  const raf = typeof scope.requestAnimationFrame === "function" ? fn => scope.requestAnimationFrame(fn)
    : typeof scope.setTimeout === "function" ? fn => scope.setTimeout(() => fn(now()), 16) : () => 0;
  const later = (fn, ms) => typeof scope.setTimeout === "function" ? scope.setTimeout(fn, ms) : fn();
  const EASE = "cubic-bezier(.2,.8,.2,1)", SNAP = "cubic-bezier(.7,0,.2,1)", MECH = "cubic-bezier(.8,0,.15,1)";
  const text = v => String(v == null ? "" : v);
  function make(tag, cls, value) {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = text(value);
    return el;
  }
  const div = (cls, value) => make("div", cls, value);
  const span = (cls, value) => make("span", cls, value);
  function deco(parent, cls, tag = "i") { const e = make(tag, cls); e.setAttribute("aria-hidden", "true"); parent.append(e); return e; }
  function anim(el, kf, o = {}) {
    if (!el || typeof el.animate !== "function" || calm()) return Promise.resolve();
    try {
      const a = el.animate(kf, { duration: T(o.dur ?? 600), delay: T(o.delay ?? 0), easing: o.ease || EASE, fill: "both" });
      return a.finished.then(() => {}, () => {});
    } catch { return Promise.resolve(); }
  }
  const wait = ms => new Promise(r => later(r, T(ms)));
  const fin = v => typeof v === "number" && Number.isFinite(v);
  const orbCenter = () => {
    const o = doc?.getElementById?.("orb");
    if (!o || typeof o.getBoundingClientRect !== "function") return [(scope.innerWidth || 0) / 2, 80];
    const r = o.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const fontOf = () => { try { return scope.getComputedStyle(doc.body).fontFamily; } catch { return "sans-serif"; } };

  /* ---------- decode: letters arrive as noise and lock in ---------- */
  const GLYPHS = "▚▞▙▟░▒/<>+=ΔΞ#0123456789";
  function decode(el, value, alive, { dur = 800, delay = 0 } = {}) {
    const str = text(value);
    el.textContent = str;
    if (calm() || !str) return Promise.resolve();
    el.textContent = ""; el.setAttribute("aria-label", str);
    const chars = [];
    for (const ch of str) { const c = span(ch === " " ? "um-c" : "um-c um-wait", ch); c.setAttribute("aria-hidden", "true"); el.append(c); chars.push([c, ch]); }
    const n = chars.length || 1, D = T(dur), d0 = T(delay);
    const plan = chars.map(([c, ch], i) => ({ c, ch, show: d0 + (i / n) * D * .45, lock: d0 + (i / n) * D * .7 + Math.random() * D * .3 }));
    return new Promise(res => {
      const t0 = now(); let swap = 0;
      const tick = t => {
        if (!alive()) { plan.forEach(p => { p.c.className = "um-c"; p.c.textContent = p.ch; }); return res(); }
        const dt = t - t0, sw = t - swap > 45; if (sw) swap = t;
        let done = 0;
        for (const p of plan) {
          if (dt >= p.lock) { if (p.c.className !== "um-c") { p.c.className = "um-c"; p.c.textContent = p.ch; } done++; }
          else if (dt >= p.show && p.ch !== " ") { p.c.className = "um-c um-scr"; if (sw) p.c.textContent = GLYPHS[Math.random() * GLYPHS.length | 0]; }
        }
        done < plan.length ? raf(tick) : res();
      };
      raf(tick);
    });
  }

  /* ---------- the field: breathing mesh + suspended dust ---------- */
  const field = (() => {
    let cv = null, g = null, W = 0, H = 0, dpr = 1, t = 0, last = 0, energy = 0, appEnergy = .12;
    let pulse = 2, pulseAmp = 0, mounts = [], running = false, lastDraw = 0;
    const ROWS = 22, COLS = 34, DUST = 620, A = [];
    const wave = (x, y, tt) => Math.sin(x * 1.3 + tt) * .5 + Math.sin(y * 1.7 - tt * .8) * .35 + Math.sin((x + y) * .9 + tt * .6) * .25;
    function build() {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) A.push({ kind: "mesh", z: r / (ROWS - 1), u: c / COLS, x: 0, y: 0, mode: "home", att: 1, flash: 0, ph: Math.random() * 7, lift: 0 });
      for (let i = 0; i < DUST; i++) A.push({ kind: "dust", bx: Math.random(), by: Math.random(), sp: .15 + Math.random() * .35, ph: Math.random() * 7, x: 0, y: 0, mode: "home", att: 1, flash: 0 });
    }
    function size() { if (!cv) return; dpr = Math.min(2, scope.devicePixelRatio || 1); W = scope.innerWidth; H = scope.innerHeight; cv.width = W * dpr; cv.height = H * dpr; }
    function meshPoint(u, z) {
      const horizon = H * .5, y0 = horizon + Math.pow(z, 1.8) * (H - horizon + 80), sp = .35 + z * 1.7;
      const e = Math.max(energy, appEnergy);
      const amp = 12 + e * 38 + pulseAmp * 46 * Math.exp(-Math.pow(z - pulse, 2) * 55);
      let lift = 0, rise = 0;
      for (const m of mounts) { const gs = Math.exp(-((u - m.u) ** 2) / m.su - ((z - m.z) ** 2) / m.sz); rise += gs * m.cur; lift = Math.max(lift, gs * Math.min(1, m.cur * 4)); }
      return [W / 2 + (u - .5) * W * sp, y0 - wave(u * 6, z * 5, t) * amp * (.3 + z) - rise * H * .24, lift];
    }
    function home(a) {
      if (a.kind === "mesh") { const p = meshPoint(a.u, a.z); a.lift = p[2]; return p; }
      return [a.bx * W + Math.sin(t * a.sp * 3 + a.ph) * 22, a.by * H * .92 + Math.cos(t * a.sp * 2.4 + a.ph) * 16];
    }
    const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    function setTween(a, tw, tnow) { tw.t0 = tnow + (tw.delay || 0); tw.live = a.mode === "home"; tw.fx = a.x; tw.fy = a.y; a.tw = tw; }
    function step(a, tnow) {
      if (a.mode === "home" && !a.tw) { [a.x, a.y] = home(a); a.att = 1; return; }
      if (a.mode === "bound" && !a.tw) { a.x = a.tx + Math.sin(tnow / 330 + a.ph) * .35; a.y = a.ty + Math.cos(tnow / 380 + a.ph) * .35; a.att = 0; return; }
      const tw = a.tw, k = (tnow - tw.t0) / (tw.dur || 1);
      if (k < 0) { if (tw.live) { [a.x, a.y] = home(a); tw.fx = a.x; tw.fy = a.y; } return; }
      const e = ease(Math.min(1, k));
      const [tx, ty] = tw.to === "home" ? home(a) : tw.to === "orb" ? orbCenter() : tw.to;
      const cx = (tw.fx + tx) / 2 + tw.ox, cy = (tw.fy + ty) / 2 + tw.oy, i = 1 - e;
      a.x = i * i * tw.fx + 2 * i * e * cx + e * e * tx; a.y = i * i * tw.fy + 2 * i * e * cy + e * e * ty;
      a.att = a.mode === "out" ? Math.pow(1 - e, 2) : a.mode === "back" ? e * e : a.att;
      if (k >= 1) {
        a.tw = null;
        if (tw.next) { setTween(a, tw.next, tnow); a.tw.fx = a.x; a.tw.fy = a.y; a.tw.live = false; return; }
        if (a.mode === "out") { a.mode = "bound"; a.flash = 1; } else if (a.mode === "back") { a.mode = "home"; a.flash = .6; }
      }
    }
    function frame(tnow) {
      if (!running) return;
      raf(frame);
      if (calm() && tnow - lastDraw < 140) return;
      if (doc?.hidden) return;
      lastDraw = tnow;
      const dt = Math.min(.05, (tnow - last) / 1000); last = tnow; t += dt * (calm() ? .08 : .35);
      energy *= .985; if (pulse < 1.6) pulse += dt * .75; else pulseAmp = 0;
      mounts = mounts.filter(m => {
        const k = Math.max(0, Math.min(1, (tnow - m.t0) / (m.dur || 1))), q = k - 1;
        const e = m.up ? 1 + 2.4 * q * q * q + 1.4 * q * q : ease(k);
        m.cur = m.from + (m.to - m.from) * e; return !(m.to === 0 && k >= 1);
      });
      for (const a of A) step(a, tnow);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const e = Math.max(energy, appEnergy);
      const gl = g.createRadialGradient(W / 2, H * .34, 0, W / 2, H * .34, Math.max(W, H) * .75);
      gl.addColorStop(0, `rgba(40,92,150,${.26 + e * .16})`); gl.addColorStop(.55, "rgba(10,26,48,.18)"); gl.addColorStop(1, "rgba(4,7,12,0)");
      g.fillStyle = gl; g.fillRect(0, 0, W, H);
      const B = Array.from({ length: 10 }, () => []), BB = Array.from({ length: 10 }, () => []);
      const seg = (a, b, base) => {
        const m = Math.min(a.att, b.att), lf = Math.max(a.lift || 0, b.lift || 0);
        if (lf > .06) { const al = (base + lf * .6) * m; if (al > .01) BB[Math.min(9, al * 12 | 0)].push(a.x, a.y, b.x, b.y); return; }
        const al = base * m; if (al > .01) B[Math.min(9, al * 30 | 0)].push(a.x, a.y, b.x, b.y);
      };
      for (let r = 0; r < ROWS; r++) { const base = .05 + (r / (ROWS - 1)) * .28; for (let c = 0; c < COLS; c++) seg(A[r * (COLS + 1) + c], A[r * (COLS + 1) + c + 1], base); }
      for (let c = 0; c <= COLS; c += 2) for (let r = 0; r < ROWS - 1; r++) seg(A[r * (COLS + 1) + c], A[(r + 1) * (COLS + 1) + c], .1);
      g.lineWidth = 1;
      const strokeAll = (L, col) => L.forEach((P, i) => { if (!P.length) return; g.strokeStyle = col(i); g.beginPath(); for (let j = 0; j < P.length; j += 4) { g.moveTo(P[j], P[j + 1]); g.lineTo(P[j + 2], P[j + 3]); } g.stroke(); });
      strokeAll(B, i => `rgba(63,125,181,${(i + .5) / 30})`);
      strokeAll(BB, i => `rgba(201,163,92,${(i + .5) / 12})`);
      g.globalCompositeOperation = "lighter";
      for (const a of A) {
        if (a.x < -20 || a.x > W + 20 || a.y < -20 || a.y > H + 20) continue;
        let s, al;
        if (a.mode === "home") {
          if (a.kind === "mesh") { if (a.flash < .05) continue; s = 1.4; al = a.flash * .8; }
          else { s = 1.3; al = .14 + .12 * Math.sin(tnow / 600 + a.ph); }
        } else if (a.mode === "bound") { const dim = a.grp && a.grp.dim; s = dim ? 1.3 : 2; al = dim ? .26 + .2 * Math.sin(tnow / 160 + a.ph * 3) : .95; }
        else { s = 1.7; al = .85; }
        g.globalAlpha = Math.max(0, al); g.fillStyle = "rgb(147,208,240)"; g.fillRect(a.x - s / 2, a.y - s / 2, s, s);
        if (a.flash > .05) { const f = a.flash, fs = s + f * 3.5; g.globalAlpha = f * .9; g.fillStyle = "rgb(201,163,92)"; g.fillRect(a.x - fs / 2, a.y - fs / 2, fs, fs); a.flash *= .9; }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    function sample(el, budget) {
      const R = el.getBoundingClientRect(), cs = scope.getComputedStyle(el);
      const oc = doc.createElement("canvas"); oc.width = Math.max(1, Math.ceil(R.width)); oc.height = Math.max(1, Math.ceil(R.height));
      const o = oc.getContext("2d");
      o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = "#fff";
      el.querySelectorAll(".uc").forEach(c => { const r = c.getBoundingClientRect(); o.fillText(c.dataset.ch, r.left - R.left + r.width / 2, r.top - R.top + r.height / 2 + parseFloat(cs.fontSize) * .04); });
      const d = o.getImageData(0, 0, oc.width, oc.height).data;
      let st = 2, pts;
      do {
        pts = [];
        for (let y = 0; y < oc.height; y += st) for (let x = ((y / st) & 1) ? st / 2 | 0 : 0; x < oc.width; x += st)
          if (d[((y | 0) * oc.width + (x | 0)) * 4 + 3] > 140) pts.push([R.left + x, R.top + y]);
        st += .5;
      } while (pts.length > budget && st < 9);
      return { pts, R };
    }
    return {
      init(canvas) {
        if (cv) return true;
        if (!canvas || typeof canvas.getContext !== "function") return false;
        const c = canvas.getContext("2d"); if (!c) return false;
        cv = canvas; g = c; build(); size(); scope.addEventListener?.("resize", size);
        running = true; last = now(); raf(frame); return true;
      },
      get active() { return running; },
      setEnergy(v) { appEnergy = Math.max(0, Math.min(1, Number(v) || 0)); },
      stir(v) { energy = Math.max(energy, v); },
      ping(a = .4) { pulse = 0; pulseAmp = a; },
      form(el, { max = 1300 } = {}) {
        if (!running || calm()) return null;
        const free = A.filter(a => a.mode === "home" || a.mode === "back");
        const { pts, R } = sample(el, Math.min(max, free.length));
        if (!pts.length) return null;
        const chosen = free.slice().sort(() => Math.random() - .5).slice(0, pts.length).sort((p, q) => p.x - q.x);
        pts.sort((p, q) => p[0] - q[0]);
        const grp = { agents: chosen, dim: false }, tnow = now(); let longest = 0;
        chosen.forEach((a, i) => {
          const [tx, ty] = pts[i], dx = tx - a.x, dy = ty - a.y, len = Math.hypot(dx, dy) || 1, sw = (Math.random() - .5) * len * .7;
          const delay = ((tx - R.left) / (R.width || 1)) * 480 + Math.random() * 240, dur = 900 + Math.random() * 600;
          setTween(a, { to: [tx, ty], dur, delay, ox: -dy / len * sw, oy: dx / len * sw }, tnow);
          a.mode = "out"; a.grp = grp; a.tx = tx; a.ty = ty;
          longest = Math.max(longest, delay + dur);
        });
        energy = Math.max(energy, .8);
        grp.done = new Promise(r => later(r, longest + 40));
        return grp;
      },
      settle(grp) { if (grp) grp.dim = true; pulse = 0; pulseAmp = 1; energy = Math.max(energy, .5); },
      release(grps, to = "home") {
        const tnow = now();
        for (const grp of grps) for (const a of grp.agents) {
          if (a.grp !== grp) continue;
          a.grp = null; a.mode = "back"; a.flash = .5;
          const ang = Math.random() * Math.PI * 2, f = 40 + Math.random() * 140;
          if (to === "orb") setTween(a, { to: "orb", dur: 650 + Math.random() * 350, delay: Math.random() * 160, ox: Math.cos(ang) * f, oy: Math.sin(ang) * f,
            next: { to: "home", dur: 1300 + Math.random() * 900, delay: 250, ox: (Math.random() - .5) * 260, oy: (Math.random() - .5) * 160 } }, tnow);
          else setTween(a, { to: "home", dur: 1100 + Math.random() * 900, delay: Math.random() * 180, ox: Math.cos(ang) * f * 1.6, oy: Math.sin(ang) * f * 1.6 }, tnow);
        }
        energy = Math.max(energy, .7);
      },
      raise(list) { const tnow = now(); mounts = list.map(d => ({ u: d.u, z: d.z, su: .006, sz: .016, from: 0, to: d.r, cur: 0, up: true, t0: tnow + (d.delay || 0), dur: d.dur || 1600 })); },
      flatten() { const tnow = now(); mounts.forEach(m => { m.from = m.cur; m.to = 0; m.up = false; m.t0 = tnow; m.dur = 800; }); }
    };
  })();

  /* ---------- orb voice state, read by the app's drawOrb ---------- */
  const voiceState = { level: 0, bands: null };
  function voice(level, bands) {
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    voiceState.level += (v - voiceState.level) * .5;
    voiceState.bands = bands && typeof bands.length === "number" && bands.length ? bands : null;
    if (voiceState.level > .02) field.stir(voiceState.level * .9);
  }

  /* ---------- mandala behind the orb while Una thinks ---------- */
  const mandala = (() => {
    let svg = null, groups = [], tp = null, spins = [], on = false;
    const NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs, parent) { const e = doc.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; }
    function build() {
      if (svg) return true;
      if (!doc?.createElementNS || !doc.body) return false;
      svg = doc.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "-110 -110 220 220"); svg.setAttribute("class", "um-mandala"); svg.setAttribute("aria-hidden", "true");
      groups = [0, 1, 2, 3].map(() => el("g", {}, svg));
      el("circle", { r: 104, class: "um-ln", opacity: .6 }, groups[0]);
      for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r2 = i % 10 ? 99 : 93; el("line", { x1: Math.cos(a) * 104, y1: Math.sin(a) * 104, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2, class: "um-ln", opacity: i % 10 ? .45 : .9 }, groups[0]); }
      el("circle", { r: 87, class: "um-sk", "stroke-dasharray": "46 9", opacity: .7 }, groups[1]);
      el("path", { id: "umMandalaPath", d: "M -76 0 A 76 76 0 1 1 76 0 A 76 76 0 1 1 -76 0", fill: "none" }, groups[1]);
      tp = el("textPath", { href: "#umMandalaPath" }, el("text", {}, groups[1]));
      el("rect", { x: -45, y: -45, width: 90, height: 90, class: "um-ln" }, groups[2]);
      el("rect", { x: -45, y: -45, width: 90, height: 90, class: "um-ln", transform: "rotate(45)" }, groups[2]);
      el("circle", { r: 64, class: "um-ln", opacity: .8 }, groups[2]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; el("circle", { cx: Math.cos(a) * 64, cy: Math.sin(a) * 64, r: 3.2, class: "um-node" }, groups[2]); }
      el("circle", { r: 52, class: "um-sk", "stroke-dasharray": "2 3", opacity: .8 }, groups[3]);
      doc.body.append(svg); return true;
    }
    function place() {
      if (!svg || !on) return;
      const [x, y] = orbCenter(), o = doc.getElementById("orb"), w = o ? o.getBoundingClientRect().width : 160;
      const sz = Math.max(150, Math.min(340, w * 1.55));
      svg.style.width = svg.style.height = sz + "px"; svg.style.left = (x - sz / 2) + "px"; svg.style.top = (y - sz / 2) + "px";
      raf(place);
    }
    return {
      show(label) {
        if (calm() || !build()) return;
        tp.textContent = `${label}     ${label}     `;
        if (on) return;
        on = true; place();
        spins.forEach(a => a.cancel());
        spins = [[0, 26000, 1], [1, 15000, -1], [2, 9000, 1], [3, 6000, -1]].map(([i, d, dir]) =>
          typeof groups[i].animate === "function" ? groups[i].animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${360 * dir}deg)` }], { duration: d, iterations: Infinity }) : null).filter(Boolean);
        anim(svg, [{ opacity: 0, transform: "scale(.4) rotate(-90deg)" }, { opacity: 1, transform: "none" }], { dur: 650, ease: "cubic-bezier(.2,1.3,.4,1)" });
      },
      hide() {
        if (!svg || !on) return;
        on = false;
        anim(svg, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.25)" }], { dur: 380, ease: "cubic-bezier(.6,0,.8,.3)" })
          .then(() => { if (!on) { spins.forEach(a => a.cancel()); spins = []; } });
      }
    };
  })();
  function phase(p, label) {
    if (p === "thinking") {
      const l = text(label).replace(/[.…]+$/, "").trim();
      mandala.show(l ? l.charAt(0).toLowerCase() + l.slice(1) : "pensando");
    } else mandala.hide();
  }

  /* ---------- particle text ---------- */
  function prep(el, value) {
    const str = text(value);
    el.textContent = ""; el.setAttribute("aria-label", str);
    str.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { el.append(doc.createTextNode(" ")); return; }
      const w = span("uw"); w.setAttribute("aria-hidden", "true");
      for (const ch of part) { const c = span("uc", ch); c.dataset.ch = ch; w.append(c); }
      el.append(w);
    });
  }
  let liveGroups = [];
  async function formText(el, value, alive, opts) {
    prep(el, value);
    if (calm() || !field.active) return;
    el.style.opacity = "0";
    const grp = field.form(el, opts);
    if (!grp) { el.style.opacity = ""; return; }
    liveGroups.push(grp);
    await grp.done;
    el.style.opacity = "";
    if (!alive()) return;
    field.settle(grp);
    await anim(el, [{ opacity: 0, filter: "blur(5px)" }, { opacity: 1, filter: "blur(0)" }], { dur: 600 });
  }
  function releaseAll(to) { if (liveGroups.length) field.release(liveGroups, to); liveGroups = []; }

  /* ---------- reel frames: each type has its own physics ---------- */
  let frameRun = 0;
  const stable = el => new Promise(res => {
    if (calm() || typeof el.getBoundingClientRect !== "function") return res();
    let prev = null, n = 0;
    const tick = () => { const r = el.getBoundingClientRect(); if ((prev && Math.abs(prev.left - r.left) < .5 && Math.abs(prev.top - r.top) < .5) || ++n > 50) return res(); prev = r; raf(tick); };
    raf(tick);
  });
  async function plotter(card, alive) {
    if (calm() || !card || card.dataset.umDone) return;
    card.dataset.umDone = "1"; card.classList.add("um-plot");
    const NS = "http://www.w3.org/2000/svg", svg = doc.createElementNS(NS, "svg"), rect = doc.createElementNS(NS, "rect");
    svg.setAttribute("class", "um-outline"); svg.setAttribute("aria-hidden", "true");
    for (const [k, v] of [["x", 0], ["y", 0], ["width", "100%"], ["height", "100%"], ["pathLength", 1]]) rect.setAttribute(k, v);
    svg.append(rect);
    const rows = [...card.children];
    card.append(svg);
    const head = deco(card, "um-head");
    rows.forEach(r => { r.style.clipPath = "inset(0 100% 0 0)"; });
    const W0 = card.offsetWidth, H0 = card.offsetHeight;
    head.style.offsetPath = `path("M0 0 H${W0} V${H0} H0 Z")`; head.style.offsetRotate = "0deg";
    anim(head, [{ opacity: 0 }, { opacity: 1 }], { dur: 120 });
    anim(rect, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { dur: 480, ease: "linear" });
    await anim(head, [{ offsetDistance: "0%" }, { offsetDistance: "100%" }], { dur: 480, ease: "linear" });
    head.style.offsetPath = "none";
    const base = card.getBoundingClientRect(); let hx = 0, hy = 0;
    for (const r of rows) {
      if (!alive()) break;
      const b = r.getBoundingClientRect(), x0 = b.left - base.left, x1 = x0 + b.width, y = b.top - base.top + b.height / 2, d = 120 + b.width * .35;
      await anim(head, [{ transform: `translate(${hx}px,${hy}px)` }, { transform: `translate(${x0}px,${y}px)` }], { dur: 80, ease: SNAP });
      anim(r, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], { dur: d, ease: "linear" });
      anim(r, [{ textShadow: "0 0 10px rgba(201,163,92,.95)" }, { textShadow: "0 0 0 rgba(201,163,92,0)" }], { dur: 1000, delay: d * .4 });
      await anim(head, [{ transform: `translate(${x0}px,${y}px)` }, { transform: `translate(${x1}px,${y}px)` }], { dur: d, ease: "linear" });
      hx = x1; hy = y;
    }
    rows.forEach(r => { r.style.clipPath = ""; });
    anim(head, [{ opacity: 1 }, { opacity: 0 }], { dur: 250 });
    field.stir(.6);
  }
  async function assemble(frame, alive) {
    if (calm() || frame.dataset.umDone) return;
    frame.dataset.umDone = "1";
    const h3 = frame.querySelector("h3"); if (!h3) return;
    const box = div("um-mech"); h3.before(box); box.append(h3);
    ["t", "b", "l", "r"].forEach(k => deco(box, "um-rail " + k));
    const pcs = ["tl", "tr", "bl", "br"].map(k => deco(box, "um-pc " + k));
    const sh = [deco(box, "um-sh t"), deco(box, "um-sh b")];
    const cells = div("um-cells"); cells.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 12; i++) cells.append(make("i"));
    box.append(cells, span("um-next", "Siguiente paso"));
    box.querySelectorAll(".um-rail").forEach((r, i) => anim(r, [{ transform: r.matches(".l,.r") ? "scaleY(0)" : "scaleX(0)" }, { transform: "none" }], { dur: 380, delay: i * 60, ease: MECH }));
    const from = { tl: "translate(-60px,-40px) rotate(-180deg)", tr: "translate(60px,-40px) rotate(180deg)", bl: "translate(-60px,40px) rotate(180deg)", br: "translate(60px,40px) rotate(-180deg)" };
    pcs.forEach((p, i) => anim(p, [{ transform: from[p.classList[1]] + " scale(1.6)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "none", opacity: 1 }], { dur: 460, delay: 300 + i * 100, ease: MECH })
      .then(() => anim(p, [{ filter: "brightness(2.2)" }, { filter: "brightness(1)" }], { dur: 320 })));
    await wait(820);
    if (!alive()) { sh.forEach(s => s.remove()); return; }
    anim(box, [{ transform: "translateY(0)" }, { transform: "translateY(3px)" }, { transform: "translateY(0)" }], { dur: 180, ease: "linear" });
    anim(sh[0], [{ transform: "translateY(0)" }, { transform: "translateY(3px)", offset: .15 }, { transform: "translateY(-103%)" }], { dur: 650, ease: MECH });
    await anim(sh[1], [{ transform: "translateY(0)" }, { transform: "translateY(-3px)", offset: .15 }, { transform: "translateY(103%)" }], { dur: 650, ease: MECH });
    sh.forEach(s => s.remove());
    [...cells.children].forEach((c, i) => anim(c, [{ background: "#1F3D5E" }, { background: "#C9A35C" }], { dur: 80, delay: i * 70, ease: "steps(1)" }));
    field.stir(.5);
  }
  function enterFrame(el, f) {
    if (!el || !f) return;
    mandala.hide();
    if (typeof el.getClientRects === "function" && !el.getClientRects().length) { leaveFrames(); return; }
    const id = ++frameRun, alive = () => id === frameRun && el.isConnected !== false;
    releaseAll("home"); field.flatten();
    if (calm()) return;
    const type = f.type || "headline";
    stable(el).then(() => {
      if (!alive()) return;
      if (type === "headline") { const h = el.querySelector("h3"); if (h) formText(h, f.text || h.textContent, alive, { max: 1200 }); }
      else if (type === "number") { field.raise([{ u: .5, z: .42, r: .55, dur: 1500 }]); field.ping(.5); }
      else if (type === "evidence") plotter(el.querySelector(".card"), alive);
      else if (type === "insight" || type === "source" || type === "capability") plotter(el.querySelector(".insight-card"), alive);
      else if (type === "action") assemble(el, alive);
    });
  }
  function leaveFrames() { frameRun++; releaseAll("home"); field.flatten(); }
  function absorb() { frameRun++; releaseAll("orb"); field.flatten(); field.stir(1); }

  /* ---------- real models, read-only, from the owner's repos ---------- */
  const RAW = "https://raw.githubusercontent.com/salcedocristhian/";
  const MODELS = {
    "5660": { remote: RAW + "5660-collins-app/main/jarvis-model.json", local: "./public/model-5660-collins.json" },
    barcelona: { remote: RAW + "Barcelona/main/jarvis-model.json", local: "./public/model-barcelona.json", marks: RAW + "Barcelona/main/data/nv5-repair-marks.json" }
  };
  const validPts = p => Array.isArray(p) && p.length > 2 && p.length < 2000 && p.every(q => Array.isArray(q) && fin(q[0]) && fin(q[1]));
  function validModel(id, d) {
    if (!d || typeof d !== "object") return false;
    if (id === "5660") return fin(d.fh) && d.shapes && typeof d.shapes === "object" && Array.isArray(d.floors) && d.floors.length > 0 && d.floors.length < 80
      && d.floors.every(f => f && typeof f.name === "string" && d.shapes[f.shape] && validPts(d.shapes[f.shape].pts));
    if (id === "barcelona") return Boolean(d.G && fin(d.G.L) && fin(d.G.D) && fin(d.G.WE) && fin(d.G.RT) && fin(d.G.RB) && fin(d.G.F2) && fin(d.G.EAVE)
      && d.CLUB && fin(d.CLUB.L) && fin(d.CLUB.D) && d.BLD && typeof d.BLD === "object" && Object.keys(d.BLD).length < 20
      && Object.values(d.BLD).every(b => b && Array.isArray(b.c) && fin(b.c[0]) && fin(b.c[1]) && fin(b.rot)));
    return false;
  }
  const validMarks = m => Array.isArray(m) && m.length > 0 && m.length < 2000 && m.every(r => Array.isArray(r) && typeof r[0] === "string" && fin(r[1]) && typeof r[2] === "string" && fin(r[3]) && fin(r[4]));
  async function getJSON(url) {
    if (typeof scope.fetch !== "function") return null;
    const ctl = typeof scope.AbortController === "function" ? new scope.AbortController() : null;
    const tm = ctl && typeof scope.setTimeout === "function" ? scope.setTimeout(() => ctl.abort(), 5000) : 0;
    try { const r = await scope.fetch(url, { cache: "no-store", signal: ctl?.signal }); return r.ok ? await r.json() : null; }
    catch { return null; } finally { if (tm) scope.clearTimeout?.(tm); }
  }
  const modelCache = {};
  function loadModel(id) {
    if (modelCache[id]) return modelCache[id];
    const m = MODELS[id]; if (!m) return Promise.resolve(null);
    modelCache[id] = (async () => {
      let data = await getJSON(m.remote);
      const live = validModel(id, data);
      if (!live) { data = await getJSON(m.local); if (!validModel(id, data)) { delete modelCache[id]; return null; } }
      const out = { id, data, live, marks: null, marksLive: false };
      if (id === "barcelona") {
        const mk = await getJSON(m.marks);
        if (validMarks(mk)) { out.marks = mk; out.marksLive = true; } else if (validMarks(data.marks)) out.marks = data.marks;
      }
      return out;
    })();
    return modelCache[id];
  }
  function modelFor(records, actions) {
    if (!records || records.kind === "jobs" || records.kind === "gmail" || records.kind === "metrics") return null;
    const hay = [actions?.contextTitle, records.title, ...(records.items || []).slice(0, 2).map(i => i?.title)].map(text).join(" ").toLowerCase();
    if (/5660|collins/.test(hay)) return "5660";
    if (/barcelona/.test(hay)) return "barcelona";
    return null;
  }

  /* ---------- canvas helpers for the stage scenes ---------- */
  function stageCanvas(host, label) {
    const cv = make("canvas", "um-cv"); cv.setAttribute("aria-label", label); cv.setAttribute("role", "img"); host.append(cv);
    const g = typeof cv.getContext === "function" ? cv.getContext("2d") : null;
    const st = { CW: 0, CH: 0, dpr: 1 };
    st.fit = () => { st.dpr = Math.min(2, scope.devicePixelRatio || 1); st.CW = cv.clientWidth; st.CH = cv.clientHeight; cv.width = st.CW * st.dpr; cv.height = st.CH * st.dpr; };
    return { cv, g, st };
  }
  function proj(st, yaw, pitch, K, cxF, cyF) {
    return (x, y, z) => {
      const a = yaw(), cy = Math.cos(a), sy = Math.sin(a), x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch), f = 5 / (5 + z2), k = K();
      return [st.CW * cxF + x1 * k * f, st.CH * cyF - y2 * k * f];
    };
  }
  function dragYaw(cv, state, onTap) {
    let down = null;
    cv.addEventListener("pointerdown", e => { down = { x: e.clientX, yaw: state.yaw, moved: false }; state.drag = true; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 5) down.moved = true; state.yaw = down.yaw + dx * .012; });
    cv.addEventListener("pointerup", e => { state.drag = false; if (!down) return; const d = down; down = null; if (!d.moved && onTap) { const r = cv.getBoundingClientRect(); onTap(e.clientX - r.left, e.clientY - r.top); } });
    cv.addEventListener("pointercancel", () => { state.drag = false; down = null; });
  }
  const tween = (state, to, ms, alive, lin) => new Promise(res => {
    const from = {}; for (const k in to) from[k] = state[k];
    const D = T(ms), t0 = now();
    const step = tt => { if (!alive()) return res(); const k = D ? Math.min(1, (tt - t0) / D) : 1, e = lin ? k : 1 - Math.pow(1 - k, 3);
      for (const key in to) state[key] = from[key] + (to[key] - from[key]) * e; k < 1 ? raf(step) : res(); };
    raf(step);
  });

  /* 5660 Collins tower from the RELATS outlines */
  function towerScene(host, side, M, alive) {
    const D = M.data, N = D.floors.length, FH = D.fh;
    const { cv, g, st } = stageCanvas(host, `Modelo de 5660 Collins, ${N} niveles`);
    if (!g) return;
    const s = { yaw: -.9, build: 0, explode: 0, sel: -1, out: 0, drag: false };
    let K = 1;
    const fit = () => { st.fit(); K = Math.min(st.CW * .42, st.CH * .9 / (N * FH * .93 + .8 + N * .03)); };
    fit();
    const P = proj(st, () => s.yaw, .38, () => K, .5, .54);
    const base = i => { const gap = FH + s.explode * .03; return i * gap - N * gap / 2; };
    const ring = (pts, y, oz) => { g.beginPath(); pts.forEach((q, j) => { const p = P(q[0], y, q[1] + oz); j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); };
    const draw = tt => {
      if (!alive() || !cv.isConnected) return;
      if (!s.drag && !calm()) s.yaw += .0035;
      if (cv.clientWidth !== st.CW) fit();
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.CW, st.CH);
      const y0 = base(0) - .03;
      g.strokeStyle = "rgba(201,163,92,.5)"; g.lineWidth = 1; g.setLineDash([10, 6]); g.beginPath();
      for (let j = 0; j <= 64; j++) { const a = j / 64 * Math.PI * 2 - tt / 5000, p = P(Math.cos(a) * 1.3, y0, Math.sin(a) * 1.3); j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      g.stroke(); g.setLineDash([]);
      for (let i = 0; i < N; i++) {
        const v = Math.max(0, Math.min(1, s.build - i)); if (v <= 0) continue;
        const F = D.floors[i], sh = D.shapes[F.shape], sel = i === s.sel, oz = sel ? s.out * .4 : 0;
        const yb = base(i) + (1 - v) * .25, yt = yb + FH * .86, col = sel ? "201,163,92" : "147,208,240", a = v * (sel ? 1 : .5);
        if (sel) { ring(sh.pts, yt, oz); g.fillStyle = "rgba(201,163,92,.16)"; g.fill(); }
        g.lineWidth = sel ? 1.3 : .9; g.strokeStyle = `rgba(${col},${a})`; ring(sh.pts, yt, oz); g.stroke();
        g.strokeStyle = `rgba(${col},${a * .5})`; ring(sh.pts, yb, oz); g.stroke();
        if (Array.isArray(sh.corners)) { g.strokeStyle = `rgba(${col},${a * .35})`; g.lineWidth = .7; g.beginPath();
          sh.corners.forEach(c => { const q = sh.pts[c]; if (!q) return; const b = P(q[0], yb, q[1] + oz), t2 = P(q[0], yt, q[1] + oz); g.moveTo(b[0], b[1]); g.lineTo(t2[0], t2[1]); }); g.stroke(); }
      }
      if (s.build > 0 && s.build < N + .5) {
        const yb = base(Math.min(N - 1, Math.floor(s.build))) + FH * (s.build % 1), sq = [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]];
        g.fillStyle = "rgba(147,208,240,.1)"; g.strokeStyle = "rgba(147,208,240,.9)"; g.lineWidth = 1.1; ring(sq, yb, 0); g.fill(); g.stroke();
      }
      raf(draw);
    };
    raf(draw);
    const info = side.querySelector(".um-pick");
    const pick = i => {
      s.sel = i; s.out = 0; tween(s, { out: 1 }, 480, alive);
      const F = D.floors[i], ft = fin(D.fhFt) ? Math.round(i * D.fhFt) : null;
      info.textContent = F.name + (ft != null ? `, unos ${ft} pies sobre la calle según el modelo del repo` : "");
    };
    dragYaw(cv, s, (x, y) => {
      if (s.build < N) return;
      let best = -1, bd = 1e9;
      for (let i = 0; i < N; i++) { const p = P(0, base(i) + FH * .43, 0), dd = Math.abs(p[1] - y); if (dd < bd) { bd = dd; best = i; } }
      if (bd < 16) pick(best);
    });
    (async () => { await tween(s, { build: N + .6 }, 2600, alive, true); await tween(s, { explode: 1 }, 900, alive); })();
  }

  /* Barcelona Gardens with the NV5 repair marks */
  const BCN_MEAN = { "B": "Grieta en viga", "B/E": "Grieta en borde de viga", "BL": "Grieta en bloque", "BR": "Ladrillo agrietado", "BR/ST": "Ladrillo y estuco agrietados", "ST": "Estuco desprendido", "ST/W": "Estuco en muro", "E": "Borde", "E/OH": "Borde en techo", "RS": "Mancha de óxido", "FL": "Piso de balcón", "FL*": "Nota de impermeabilización", "C": "Código fuera de la leyenda", "CK": "Esquina agrietada", "SP": "Desprendimiento sin etiqueta" };
  function barcelonaScene(host, side, M, alive) {
    const { cv, g, st } = stageCanvas(host, "Barcelona Gardens con marcas de reparación de NV5");
    if (!g) return;
    const { G, CLUB, BLD } = M.data, IDS = Object.keys(BLD);
    const xs = IDS.map(b => BLD[b].c[0]), zs = IDS.map(b => BLD[b].c[1]);
    const CX = (Math.min(...xs) + Math.max(...xs)) / 2, CZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const SC = 1 / Math.max(120, (Math.max(...xs) - Math.min(...xs) + G.L) / 2 * 1.05);
    const dims = b => b === "club" ? [CLUB.L, CLUB.D] : [G.L, G.D];
    const rotOf = b => [Math.cos(BLD[b].rot), Math.sin(BLD[b].rot)];
    const toW = (b, X, Z) => { const [c, sn] = rotOf(b), [L, Dd] = dims(b), x = X - L / 2, z = Z - Dd / 2; return [BLD[b].c[0] + x * c + z * sn, BLD[b].c[1] - x * sn + z * c]; };
    const dirW = (b, nx, nz) => { const [c, sn] = rotOf(b); return [nx * c + nz * sn, -nx * sn + nz * c]; };
    const N2 = v => [(v[0] - CX) * SC, (v[1] - CZ) * SC];
    const foot = b => b === "club" ? [[0, 0], [CLUB.L, 0], [CLUB.L, CLUB.D], [0, CLUB.D]]
      : [[0, 0], [G.WE, 0], [G.WE, G.RT], [G.L - G.WE, G.RT], [G.L - G.WE, 0], [G.L, 0], [G.L, G.D], [G.L - G.WE, G.D], [G.L - G.WE, G.RB], [G.WE, G.RB], [G.WE, G.D], [0, G.D]];
    const SH = Object.fromEntries(IDS.map(b => [b, foot(b).map(p => N2(toW(b, p[0], p[1])))]));
    const levels = b => b === "club" ? [0, CLUB.EAVE] : [0, G.F2, G.EAVE];
    const hOf = m => { const bse = m.f === 1 ? 0 : G.F2, c = m.code; if (m.b === "club") return 5; if (c === "FL") return bse + .5; if (c === "FL*") return .5;
      if (/^(B|B\/E|E|E\/OH|C|CK)$/.test(c)) return m.f === 1 ? 8.7 : 17.9; if (c === "BL") return bse + 4; if (c === "RS") return bse + 7.6; if (c.indexOf("BR") === 0) return bse + 7; return bse + 4.8; };
    const normOf = m => { const [L] = dims(m.b), nx = m.X <= .5 ? -1 : (m.X >= L - .5 ? 1 : 0); if (nx) return [nx, 0]; if (m.b === "club") return [0, m.Z <= .5 ? -1 : 1];
      return [0, m.Z <= G.RT + .6 ? -1 : (m.Z >= G.RB - .6 ? 1 : (m.Z < (fin(G.CC) ? G.CC : G.D / 2) ? -1 : 1))]; };
    const MK = (M.marks || []).filter(r => BLD[r[0]]).map((r, i) => {
      const m = { id: i, b: r[0], f: r[1], code: r[2], X: r[3], Z: r[4], note: text(r[5]), X2: r[7], Z2: r[8] };
      const x = fin(m.X2) ? (m.X + m.X2) / 2 : m.X, z = fin(m.Z2) ? (m.Z + m.Z2) / 2 : m.Z;
      const n = dirW(m.b, ...normOf(m)), w = toW(m.b, x, z), p = N2([w[0] + n[0] * 1.5, w[1] + n[1] * 1.5]);
      m.x = p[0]; m.z = p[1]; m.y = hOf(m) * SC; let a = Math.atan2(m.z, m.x); if (a < 0) a += Math.PI * 2; m.ang = a; m.on = 0; m.flash = 0; return m;
    });
    const COUNT = {}; MK.forEach(m => { COUNT[m.b] = (COUNT[m.b] || 0) + 1; });
    const s = { yaw: .5, sweep: -1, fx: 0, fz: 0, zoom: 1, focus: null, sel: null, drag: false };
    let K = 1; const fit = () => { st.fit(); K = Math.min(st.CW * .46, st.CH * .7); }; fit();
    const P0 = proj(st, () => s.yaw, .78, () => K, .5, .5);
    const P = (x, y, z) => P0((x - s.fx) * s.zoom, y * s.zoom, (z - s.fz) * s.zoom);
    const path = (pts, y) => { g.beginPath(); pts.forEach((q, j) => { const p = P(q[0], y, q[1]); j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); };
    const cen = b => { const p = SH[b]; return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length]; };
    const font = fontOf(); let bTap = [];
    const draw = tt => {
      if (!alive() || !cv.isConnected) return;
      if (!s.drag && !calm()) s.yaw += .0012;
      if (cv.clientWidth !== st.CW) fit();
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.CW, st.CH);
      for (let r = .4; r <= 1.2; r += .4) { g.strokeStyle = "rgba(63,125,181,.3)"; g.lineWidth = 1; g.beginPath();
        for (let j = 0; j <= 72; j++) { const a = j / 72 * Math.PI * 2, p = P(Math.cos(a) * r, 0, Math.sin(a) * r); j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); }
      if (s.sweep >= 0 && s.sweep < Math.PI * 2 + .6) {
        for (let k = 0; k < 12; k++) { const a0 = s.sweep - k * .05, a1 = a0 - .05; if (a0 < 0) break;
          const p0 = P(0, 0, 0), p1 = P(Math.cos(a0) * 1.3, 0, Math.sin(a0) * 1.3), p2 = P(Math.cos(a1) * 1.3, 0, Math.sin(a1) * 1.3);
          g.fillStyle = `rgba(147,208,240,${.22 * (1 - k / 12)})`; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.closePath(); g.fill(); }
      }
      bTap = [];
      for (const b of IDS) {
        const pts = SH[b], lv = levels(b), dim = s.focus && s.focus !== b ? .25 : 1, hot = s.focus === b, col = hot ? "230,240,247" : "147,208,240";
        lv.forEach((y, i) => { path(pts, y * SC); g.strokeStyle = `rgba(${col},${(i ? .6 : .35) * dim})`; g.lineWidth = hot ? 1.2 : .9; g.stroke(); });
        g.strokeStyle = `rgba(${col},${.3 * dim})`; g.lineWidth = .7; g.beginPath();
        pts.forEach(q => { const a = P(q[0], 0, q[1]), c = P(q[0], lv[lv.length - 1] * SC, q[1]); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); }); g.stroke();
        const cc = cen(b), lp = P(cc[0], ((b === "club" ? CLUB.TOP : G.TOP) || 20) * SC, cc[1]);
        g.font = `600 ${hot ? 13 : 11}px ${font}`; g.textAlign = "center"; g.fillStyle = `rgba(230,240,247,${.9 * dim})`;
        g.fillText(b === "club" ? "Club" : b, lp[0], lp[1] - 4); bTap.push([b, lp[0], lp[1]]);
      }
      for (const m of MK) {
        if (!m.on) continue;
        const p = P(m.x, m.y, m.z), dim = s.focus && s.focus !== m.b ? .25 : 1, sel = s.sel === m, pulse = s.focus === m.b ? .5 + .5 * Math.sin(tt / 200 + m.id) : 0;
        if (m.flash > .02) { g.strokeStyle = `rgba(201,163,92,${m.flash})`; g.lineWidth = 1.1; g.beginPath(); g.arc(p[0], p[1], 3 + (1 - m.flash) * 14, 0, 7); g.stroke(); m.flash *= .93; }
        g.fillStyle = sel ? "#fff" : `rgba(201,163,92,${(.75 + .25 * pulse) * dim})`; g.beginPath(); g.arc(p[0], p[1], sel ? 4 : 2.1 + pulse, 0, 7); g.fill();
        m.sx = p[0]; m.sy = p[1];
      }
      raf(draw);
    };
    raf(draw);
    const info = side.querySelector(".um-pick"), bName = b => b === "club" ? "Club" : `Edificio ${b}`;
    function focus(b) {
      s.focus = b; s.sel = null; const c = cen(b), up = MK.filter(m => m.b === b && m.f === 2).length, n = COUNT[b] || 0;
      info.textContent = `${bName(b)}: ${n} marcas de NV5, ${n - up} en planta baja y ${up} en el segundo piso.`;
      tween(s, { fx: c[0], fz: c[1], zoom: b === "club" ? 2.6 : 2 }, 1000, alive);
    }
    dragYaw(cv, s, (x, y) => {
      if (s.sweep < Math.PI * 2) return;
      let best = null, bd = 14;
      MK.forEach(m => { if (m.sx == null || (s.focus && s.focus !== m.b)) return; const dd = Math.hypot(m.sx - x, m.sy - y); if (dd < bd) { bd = dd; best = m; } });
      if (best) { s.sel = best; info.textContent = `${BCN_MEAN[best.code] || best.code}, ${bName(best.b).toLowerCase()}, ${best.f === 1 ? "planta baja" : "segundo piso"}. Nota de NV5: ${best.note}`; return; }
      let bb = null; bd = 40; bTap.forEach(([b, bx, by]) => { const dd = Math.hypot(bx - x, by - y); if (dd < bd) { bd = dd; bb = b; } });
      if (bb) focus(bb); else if (s.focus) { s.focus = null; s.sel = null; tween(s, { fx: 0, fz: 0, zoom: 1 }, 800, alive); }
    });
    (async () => {
      let found = 0;
      const tick = () => { MK.forEach(m => { if (!m.on && m.ang <= s.sweep) { m.on = 1; m.flash = 1; found++; } }); info.textContent = `${found} de ${MK.length} marcas encontradas`; };
      if (!calm()) { const iv = scope.setInterval?.(tick, 60); await tween(s, { sweep: Math.PI * 2 + .6 }, 2600, alive, true); scope.clearInterval?.(iv); }
      MK.forEach(m => { m.on = 1; }); s.sweep = 99;
      if (!alive()) return;
      const top = IDS.filter(b => b !== "club").sort((a, b) => (COUNT[b] || 0) - (COUNT[a] || 0))[0];
      if (top && COUNT[top]) focus(top); else info.textContent = MK.length ? `${MK.length} marcas` : "Sin marcas de NV5 disponibles";
    })();
  }

  /* constellation for a list of records: one star per record, positions carry no meaning */
  function constellation(host, items, alive) {
    const { cv, g, st } = stageCanvas(host, `${items.length} registros`);
    if (!g) return;
    st.fit();
    const n = Math.min(12, items.length), stars = Array.from({ length: n }, (_, i) => ({ a: i / n * Math.PI * 2 - Math.PI / 2, r: .62 + (i % 2) * .22, t: text(items[i]?.title).slice(0, 26) }));
    const s = { k: 0 }, font = fontOf();
    const draw = tt => {
      if (!alive() || !cv.isConnected) return;
      if (cv.clientWidth !== st.CW) st.fit();
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.CW, st.CH);
      const cx = st.CW / 2, cy = st.CH / 2, R = Math.min(st.CW * .42, st.CH * .44), spin = tt / 40000;
      g.fillStyle = "rgba(201,163,92,.9)"; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
      stars.forEach((p, i) => {
        const v = Math.max(0, Math.min(1, s.k * n - i)); if (!v) return;
        const a = p.a + spin, x = cx + Math.cos(a) * R * p.r * 1.25, y = cy + Math.sin(a) * R * p.r;
        g.strokeStyle = `rgba(147,208,240,${.5 * v})`; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (x - cx) * v, cy + (y - cy) * v); g.stroke();
        g.fillStyle = `rgba(147,208,240,${v})`; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
        if (i < 4 && v >= 1) {
          g.font = `500 11px ${font}`; g.fillStyle = "rgba(230,240,247,.85)";
          let label = p.t; while (label.length > 4 && g.measureText(label).width > Math.max(40, (x < cx ? x : st.CW - x) - 10)) label = label.slice(0, -2);
          if (label !== p.t) label = label.trimEnd() + "…";
          g.textAlign = x < cx ? "right" : "left"; g.fillText(label, x + (x < cx ? -7 : 7), y + 4);
        }
      });
      raf(draw);
    };
    raf(draw);
    tween(s, { k: 1 }, 1600, alive, true);
  }

  /* terrain chart: peak heights are proportional to the JobTread amounts; labels are the source strings */
  function terrainChart(host, rows, alive) {
    const { cv, g, st } = stageCanvas(host, "Terreno con una montaña por cifra de JobTread");
    if (!g) return;
    st.fit();
    const max = Math.max(0, ...rows.map(r => r.num).filter(v => v != null && v > 0));
    const s = { k: 0 };
    const draw = () => {
      if (!alive() || !cv.isConnected) return;
      if (cv.clientWidth !== st.CW) st.fit();
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.CW, st.CH);
      const W = st.CW, H = st.CH, rowsN = 9, cols = 30;
      const hAt = (u, z) => { let h = 0; rows.forEach((r, i) => { if (r.num == null || r.num <= 0 || !max) return; const cu = (i + .5) / rows.length;
        h += (r.num / max) * Math.exp(-((u - cu) ** 2) / .004 - ((z - .55) ** 2) / .05); }); return h * s.k; };
      const P = (u, z) => { const y0 = H * .32 + Math.pow(z, 1.4) * H * .62, sp = .45 + z; return [W / 2 + (u - .5) * W * sp, y0 - hAt(u, z) * H * .55]; };
      for (let r = 0; r < rowsN; r++) { const z = r / (rowsN - 1); g.beginPath();
        for (let c = 0; c <= cols; c++) { const p = P(c / cols, z); c ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
        g.strokeStyle = `rgba(147,208,240,${.15 + z * .35})`; g.lineWidth = 1; g.stroke(); }
      for (let c = 0; c <= cols; c += 2) { g.beginPath(); for (let r = 0; r < rowsN; r++) { const p = P(c / cols, r / (rowsN - 1)); r ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
        const lit = rows.some((row, i) => row.num != null && row.num > 0 && Math.abs(c / cols - (i + .5) / rows.length) < .07);
        g.strokeStyle = lit ? "rgba(201,163,92,.75)" : "rgba(63,125,181,.25)"; g.stroke(); }
      raf(draw);
    };
    raf(draw);
    tween(s, { k: 1 }, 1700, alive);
  }

  /* ---------- the motion stage for record results ---------- */
  let stage = null, last = null, stageRun = 0;
  const sceneFor = kind => kind === "gmail" ? "gmail" : kind === "metrics" ? "budget" : "project";
  function count(records) {
    const value = Number.isInteger(records.total) && records.total >= 0 ? records.total : records.items.length;
    return Number.isInteger(records.total) && records.total >= 0 ? (records.approximate ? "≈ " : "") + value.toLocaleString("en-US")
      : records.items.length.toLocaleString("en-US") + " en página";
  }
  const parseAmount = v => { const str = text(v); if (!/\d/.test(str)) return null; const n = Number(str.replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null; };
  function render(records, actions = {}) {
    if (!records || !Array.isArray(records.items)) return reset();
    mandala.hide();
    stage = doc.getElementById("motionStage");
    if (!stage) return;
    const id = ++stageRun, alive = () => id === stageRun;
    const scene = sceneFor(records.kind);
    last = { kind: scene, records };
    stage.textContent = "";
    stage.hidden = false;
    stage.className = "motion-stage um-stage motion-" + scene;
    stage.dataset.scene = scene;
    stage.setAttribute("role", "region");
    stage.setAttribute("aria-label", scene === "gmail" ? "Correos encontrados" : scene === "budget" ? "Cifras de JobTread" : "Proyecto consultado");
    const shell = div("motion-shell um-shell");
    const header = div("motion-topline");
    header.append(span("motion-source", scene === "gmail" ? "Gmail, solo lectura" : "JobTread, solo lectura"), span("motion-verified", "Datos consultados"));
    const body = div("motion-scene-body um-body");
    const footer = div("motion-summary");
    footer.append(span("motion-counter", count(records)), span("motion-caption", scene === "gmail" ? "mensajes, toca uno para leerlo" :
      scene === "budget" ? "cifras tal como vienen de JobTread" : records.kind === "jobs" ? "proyectos consultados" : "registros del proyecto"));
    const btn = make("button", "motion-inspect");
    btn.type = "button";
    btn.textContent = scene === "gmail" ? "Abrir primer correo" : scene === "budget" ? "Ver cifras exactas" : "Explorar registros";
    btn.addEventListener("click", () => {
      if (typeof actions.openFirst === "function") actions.openFirst();
      else doc.querySelector("#dataExplorer .explorer-row")?.click();
    });
    footer.append(btn);
    shell.append(header, body, footer);
    stage.append(shell);
    if (scene === "gmail") gmailScene(body, records, alive);
    else if (scene === "budget") budgetScene(body, records);
    else projectScene(body, records, actions, alive);
    if (scene === "budget") terrainLater(body, alive);
  }
  function gmailScene(body, records, alive) {
    const list = div("um-mail");
    const items = records.items.slice(0, 3);
    if (!items.length) list.append(div("um-empty", "No hay mensajes en esta búsqueda"));
    const cards = items.map(m => { const c = div("um-paper" + (/NO LE[IÍ]DO/i.test(text(m.tag) + " " + text(m.detail)) ? " unread" : ""));
      c.append(span("um-paper-t", m.title), span("um-paper-s", m.subtitle)); list.append(c); return c; });
    body.append(list);
    if (calm() || typeof scope.setTimeout !== "function") return;
    cards.forEach(c => { c.style.opacity = "0"; });
    (async () => {
      await wait(60);
      const [ox, oy] = orbCenter();
      for (let n = cards.length - 1; n >= 0; n--) {
        if (!alive()) { cards.forEach(c => { c.style.opacity = ""; }); return; }
        const c = cards[n], b = c.getBoundingClientRect(), dx = ox - (b.left + b.width / 2), dy = oy - (b.top + b.height / 2), side = n % 2 ? 1 : -1, rest = (Math.random() - .5) * 2.4, kf = [];
        for (let i = 0; i <= 12; i++) { const p = i / 12, q = 1 - p, sway = Math.sin(p * Math.PI * 2.6) * q;
          kf.push({ offset: p * .86, opacity: Math.min(1, p * 6), transform: `translate(${dx * q + sway * 40 * side}px,${dy * (1 - (p * .55 + p * p * .45))}px) rotate(${sway * 22 * side + rest * p}deg) rotateX(${36 * q}deg) scale(${.35 + .65 * Math.min(1, p * 1.6)})` }); }
        kf.push({ offset: .93, opacity: 1, transform: `translate(0,3px) rotate(${rest}deg) scale(1.02,.94)` });
        kf.push({ offset: 1, opacity: 1, transform: `rotate(${rest}deg)` });
        c.style.opacity = "";
        anim(c, kf, { dur: 1250, ease: "linear" });
        await wait(300);
      }
      field.stir(.5);
    })();
  }
  const EXPECTED = ["Projected Price", "Projected Cost", "Actual Cost"];
  function budgetRows(records) {
    return EXPECTED.map(k => { const item = records.items.find(x => x.title === k); return { k, value: item?.value || "No disponible", num: parseAmount(item?.value) }; });
  }
  function budgetScene(body, records) {
    const chart = div("um-terrain"); body.append(chart);
    const legend = div("um-legend");
    budgetRows(records).forEach(r => { const b = div("motion-budget-value"); b.append(span("motion-budget-label", r.k), span("motion-budget-amount", r.value)); legend.append(b); });
    body.append(legend);
    body._rows = budgetRows(records);
  }
  function terrainLater(body, alive) { const chart = body.querySelector?.(".um-terrain"); if (chart && body._rows) terrainChart(chart, body._rows, alive); }
  function projectScene(body, records, actions, alive) {
    const wrap = div("um-proj"), viz = div("um-viz"), side = div("um-side");
    const first = records.items[0];
    side.append(span("um-name", records.kind === "jobs" ? (first?.title || "Sin proyectos") : (actions.contextTitle || records.title || "Proyecto")));
    side.append(span("um-kind", records.kind === "jobs" ? (first?.detail || "Selecciona un proyecto") : records.title));
    const marks = div("motion-project-nodes");
    records.items.slice(0, 3).forEach((it, i) => {
      const m = div("motion-data-mark");
      m.append(span("motion-data-mark-title", records.kind === "overview" ? it.title : records.kind === "jobs" ? "Proyecto " + (i + 1) : (it.tag || "Registro")),
        span("motion-data-mark-value", records.kind === "overview" ? it.value : it.title));
      marks.append(m);
    });
    if (!records.items.length) { const m = div("motion-data-mark"); m.append(span("motion-data-mark-title", "Estado"), span("motion-data-mark-value", "Sin registros en esta consulta")); marks.append(m); }
    side.append(marks);
    const pickLine = span("um-pick", ""); side.append(pickLine);
    const src = span("um-src", "");
    side.append(src);
    wrap.append(viz, side); body.append(wrap);
    const mid = modelFor(records, actions);
    if (!mid) {
      src.textContent = records.kind === "jobs" ? "Mapa de los proyectos consultados" : "Este proyecto aún no tiene modelo 3D conectado";
      constellation(viz, records.items, alive); return;
    }
    src.textContent = "Buscando el modelo 3D del proyecto";
    loadModel(mid).then(M => {
      if (!alive()) return;
      if (!M) { src.textContent = "No pude leer el modelo 3D; muestro el mapa de registros"; constellation(viz, records.items, alive); return; }
      stage?.classList.add("um-tall");
      if (mid === "5660") {
        src.textContent = "Silueta de los planos RELATS, repo 5660-collins-app" + (M.live ? "" : " (copia guardada en Jarvis)");
        pickLine.textContent = "Toca un piso para ubicarlo";
        towerScene(viz, side, M, alive);
      } else {
        src.textContent = "Medidas del repo Barcelona; marcas de " + (M.marksLive ? "data/nv5-repair-marks.json" : "la copia guardada en Jarvis");
        barcelonaScene(viz, side, M, alive);
      }
    });
  }
  function reset() {
    stageRun++;
    if (stage) { stage.textContent = ""; stage.hidden = true; stage.className = "motion-stage"; }
    last = null;
  }

  scope.JarvisMotion = Object.freeze({
    render, reset, sceneFor, enterFrame, leaveFrames, absorb, phase, voice, loadModel, modelFor,
    validModel, validMarks,
    init: canvas => field.init(canvas), setEnergy: v => field.setEnergy(v),
    get voiceState() { return voiceState; },
    get activeScene() { return last?.kind || null; }
  });
})(globalThis);
