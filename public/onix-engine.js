/* ÓNIX engine: the orb and the mesh, mounted into any element.
   Extracted from the ÓNIX demos. Text from users or providers is always set with textContent. */
(function (scope) {
"use strict";
function mount(root, opts = {}) {
root.classList.add("onx-root");
root.innerHTML = '<canvas class="onx-cv" aria-hidden="true"></canvas><div class="onx-labels"></div><div class="onx-cal" aria-hidden="true"></div>'
  + '<div class="onx-sub" aria-live="polite"><p class="onx-q"></p><p class="onx-a"></p></div><div class="onx-ui"></div>';
const RM = Boolean(opts.calm) || matchMedia("(prefers-reduced-motion: reduce)").matches;
const T = ms => RM ? 0 : ms;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = k => k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const lerp = (a, b, e) => a + (b - a)*e;
const wrap = a => { a = (a + Math.PI) % (Math.PI*2); if(a < 0) a += Math.PI*2; return a - Math.PI; };
const SKY = [147,208,240], BRASS = [201,163,92];
const cv = root.querySelector(".onx-cv"), g = cv.getContext("2d"), labels = root.querySelector(".onx-labels");
const qEl = root.querySelector(".onx-q"), aEl = root.querySelector(".onx-a");
const DATA = opts.data || {};
let alive = true;
let W = 0, H = 0, dpr = 1;
const L = {};
function layout(){
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W*dpr; cv.height = H*dpr;
  L.R0 = Math.max(34, Math.min(58, W*.13, H*.07));
  L.hx = W/2; L.hy = Math.max(90, H*.2);
  L.hz = H*.47;
  L.zc = .36;
}
layout(); scope.addEventListener("resize", layout);

/* ---------- mesh: the floor of everything; its own vertices rise into bars ---------- */
const ROWS = 19, COLS = 36;
const lift = Array.from({length:ROWS}, () => new Float32Array(COLS + 1));
let kick = 0, meshIn = 0, bars = [], spot = { k:0, r:.11 }, scan = -1, voice = 0, voiceSmooth = 0;
function MP(u, z, h, t){
  const y0 = L.hz + Math.pow(z, 1.55)*(H*1.06 - L.hz), sp = .42 + z*1.9;
  let wv = RM ? 0 : (Math.sin(u*7.8 + t*.5)*.5 + Math.sin(z*8.5 - t*.4)*.35)*2.2*(.3 + z);
  const dd = Math.hypot((u - .5)*2.2, z - L.zc);
  if(voiceSmooth > .01) wv += voiceSmooth*9*Math.sin(dd*16 - t*9)*Math.exp(-dd*2.2)*(.3 + z);
  if(kick > .01) wv += kick*16*Math.sin(dd*18 - t*14)*Math.exp(-dd*1.6)*(.3 + z);
  return [W/2 + (u - .5)*W*sp*1.1, y0 - wv - h*sp, sp];
}
function drawMesh(t){
  for(let r = 0; r < ROWS; r++) lift[r].fill(0);
  for(const b of bars) for(let r = b.r0; r <= b.r0 + 2; r++) for(let c = b.c0; c <= b.c0 + 2; c++) lift[r][c] = Math.max(lift[r][c], b.h);
  const P = [];
  for(let r = 0; r < ROWS; r++){ const z = r/(ROWS - 1), row = [];
    for(let c = 0; c <= COLS; c++){ const u = c/COLS, p = MP(u, z, lift[r][c], t);
      const d = Math.hypot((u - .5)*2.2, z - L.zc); p.push(spot.k*Math.exp(-(d*d)/(spot.r*spot.r)), z, u); row.push(p); }
    P.push(row); }
  const buckets = {};
  const seg = (a, b, base, hot) => {
    if(meshIn < 1){ const m = clamp((meshIn*.75 - Math.abs((a[5] + b[5])/2 - .5) - Math.max(a[4], b[4])*.15)*8); base *= m; if(m <= 0) return; }
    const glow = Math.max(a[3], b[3]), sc = scan >= 0 ? Math.max(0, 1 - Math.abs((a[4] + b[4])/2 - scan)*14) : 0;
    let al = base + glow*.55 + sc*.6, brass = false;
    if(hot){ al = Math.max(al, .65); }
    al = Math.min(1, Math.round(al*20)/20); if(al < .02) return;
    const key = (brass ? "b" : "s") + al; (buckets[key] ||= []).push(a[0], a[1], b[0], b[1]);
  };
  for(let r = 0; r < ROWS; r++){ const base = .045 + (r/(ROWS - 1))*.24;
    for(let c = 0; c < COLS; c++) seg(P[r][c], P[r][c + 1], base, lift[r][c] > 1 || lift[r][c + 1] > 1); }
  for(let c = 0; c <= COLS; c++) for(let r = 0; r < ROWS - 1; r++) seg(P[r][c], P[r + 1][c], .03 + (r/(ROWS - 1))*.12, lift[r][c] > 1 || lift[r + 1][c] > 1);
  g.lineWidth = 1;
  for(const key in buckets){ const Lb = buckets[key], c = key[0] === "b" ? BRASS : SKY; g.strokeStyle = `rgba(${c},${+key.slice(1)})`; g.beginPath();
    for(let j = 0; j < Lb.length; j += 4){ g.moveTo(Lb[j], Lb[j + 1]); g.lineTo(Lb[j + 2], Lb[j + 3]); } g.stroke(); }
  // filled faces of lifted blocks: walls faint, tops brighter
  for(const b of bars){
    if(b.h < 1) continue;
    const q = (pts, a) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = `rgba(147,208,240,${a})`; g.fill(); };
    const r0 = b.r0, c0 = b.c0;
    q([P[r0][c0], P[r0][c0 + 2], P[r0 + 2][c0 + 2], P[r0 + 2][c0]], .16);
    q([P[r0 + 2][c0], P[r0 + 2][c0 + 2], P[r0 + 3][c0 + 2], P[r0 + 3][c0]], .07);
    q([P[r0][c0 + 2], P[r0 + 2][c0 + 2], P[r0 + 2][c0 + 3], P[r0][c0 + 3]], .05);
    q([P[r0][c0 - 1], P[r0 + 2][c0 - 1], P[r0 + 2][c0], P[r0][c0]], .05);
    b.top = P[r0][c0 + 1]; b.base = P[r0 + 3][c0 + 1];
    if(b.lab){ b.lab.style.left = b.top[0] + "px"; b.lab.style.top = (b.top[1] - 6) + "px"; }
  }
  if(cal.k > .01){
    for(let d = 0; d < 7; d++){ const c0 = 7 + d*3, q = [P[6][c0], P[6][c0 + 3], P[9][c0 + 3], P[9][c0]], hot = d === cal.hotIdx ? cal.hot : 0;
      g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = hot > .02 ? `rgba(201,163,92,${(.08 + .22*hot)*cal.k})` : `rgba(147,208,240,${.05*cal.k})`; g.fill();
      g.strokeStyle = hot > .02 ? `rgba(201,163,92,${.9*hot*cal.k})` : `rgba(147,208,240,${.35*cal.k})`; g.lineWidth = hot > .02 ? 1.5 : 1; g.stroke();
      const lab = cal.labs[d]; lab.style.left = ((P[9][c0][0] + P[9][c0 + 3][0])/2) + "px"; lab.style.top = ((P[9][c0][1] + P[9][c0 + 3][1])/2) + "px";
      lab.querySelector("span").style.color = d === cal.hotIdx && cal.hot > .5 ? "var(--brass)" : ""; }
  }
  return P;
}
const cal = { k:0, hot:0, hotIdx:1, labs:["MON 16", "TUE 17", "WED 18", "THU 19", "FRI 20", "SAT 21", "SUN 22"].map(t => { const el = document.createElement("div"); el.className = "lab day"; el.innerHTML = "<span></span>"; el.querySelector("span").textContent = t; root.querySelector(".onx-cal").append(el); return el; }) };

/* ---------- the orb: points that become the answer ---------- */
const N = 640, D = 700;
const FIB = Array.from({length:N}, (_, i) => { const y = 1 - (i/(N - 1))*2, r = Math.sqrt(1 - y*y), th = i*2.39996; return [Math.cos(th)*r, y, Math.sin(th)*r]; });
const pts = FIB.map((_, i) => ({ i, slot:i, x:0, y:0, z:0, cx:0, cy:0, yaw:0, pi:.35, col:0, al:1, t0:0, dur:1, X:0, Y:0, F:1 }));
const inv = new Int32Array(N);
let rot = 0, mode = "idle", linkA = 0, linkTarget = 0, cur = null, listenLv = 0;
const ground = () => { const p = MP(.5, L.zc, 0, 0); return [p[0], p[1]]; };
function perim(p){ let d = 0; for(let i = 0; i < p.length; i++){ const a = p[i], b = p[(i + 1) % p.length]; d += Math.hypot(b[0] - a[0], b[1] - a[1]); } return d; }
function resample(p, n){
  const tot = perim(p), out = []; let i = 0, acc = 0;
  for(let k = 0; k < n; k++){ const want = k/n*tot;
    while(true){ const a = p[i % p.length], b = p[(i + 1) % p.length], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if(acc + seg >= want || i > p.length*2){ const u = seg ? (want - acc)/seg : 0; out.push([a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u]); break; }
      acc += seg; i++; } }
  return out;
}
const SH = {
  orb: () => ({ cx:L.hx, cy:L.hy, spin:1, rate:.25, pitch:.35, links:[], col:() => 0, al:() => 1,
    at(s, t){ const [x, y, z] = FIB[s]; let r = L.R0;
      if(mode === "listen") r *= 1.05 + listenLv*.08 + .02*Math.sin(t*2.4); else r *= 1 + .012*Math.sin(t*1.1);
      if(voice > .01) r *= 1 + voice*.12*(.5 + .5*Math.sin(y*7 + t*11 + Math.sin(x*5 + t*3)));
      return [x*r, y*r, z*r]; } }),
  think: () => {
    const core = Math.floor(N*.34), per = Math.floor((N - core)/3);
    return { cx:L.hx, cy:L.hy, spin:0, rate:0, pitch:0, links:[],
      at(s, t){
        if(s < core){ const [x, y, z] = FIB[Math.floor(s/core*N)], a = t*.8, r = L.R0*.5; return [(x*Math.cos(a) - z*Math.sin(a))*r, y*r, (x*Math.sin(a) + z*Math.cos(a))*r]; }
        const k = Math.min(2, Math.floor((s - core)/per)), j = (s - core) - k*per, r = L.R0*(1.25 + k*.2);
        const th = j/per*Math.PI*2 + t*(.9 + k*.4)*(k % 2 ? -1 : 1);
        let x = Math.cos(th)*r, y = Math.sin(th)*r, z = 0; const tx = .5 + k*.9, ty = k*1.1;
        [y, z] = [y*Math.cos(tx) - z*Math.sin(tx), y*Math.sin(tx) + z*Math.cos(tx)];
        [x, z] = [x*Math.cos(ty) - z*Math.sin(ty), x*Math.sin(ty) + z*Math.cos(ty)];
        return [x, y, z]; },
      col(s){ if(s < core) return 0; const k = Math.floor((s - core)/per), j = (s - core) - k*per; return k === 0 && j < per*.14 ? 1 : 0; },
      al: s => s < core ? .9 : .7 };
  },
  scatter: () => { const P = FIB.map(() => [(Math.random() - .5)*W*1.2, (Math.random() - .5)*H*1.1, (Math.random() - .5)*300]);
    return { cx:W/2, cy:H/2, spin:0, rate:0, pitch:0, links:[], at:s => P[s], col:() => 0, al:() => .35 }; },
  glyph: o => {
    const c = document.createElement("canvas"), w = Math.ceil(o.w), h = Math.ceil(o.h); c.width = w; c.height = h;
    const x = c.getContext("2d"); let fs = h*.95; x.font = `500 ${fs}px Unbounded, sans-serif`; const mw = x.measureText(o.text).width; if(mw > w) fs *= w/mw;
    x.font = `500 ${fs}px Unbounded, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff"; x.fillText(o.text, w/2, h/2);
    const d = x.getImageData(0, 0, w, h).data; let st = 1.5, P;
    do { P = []; for(let yy = 0; yy < h; yy += st) for(let xx = 0; xx < w; xx += st) if(d[((yy|0)*w + (xx|0))*4 + 3] > 130) P.push([xx - w/2, h/2 - yy, (Math.random() - .5)*6]); st += .25; } while(P.length > N);
    const n = P.length; while(P.length < N) P.push([0, 0, 0]);
    return { cx:o.cx, cy:o.cy, spin:0, rate:0, pitch:0, links:[], at:(s, t) => s < n ? [P[s][0], P[s][1] + Math.sin(t*2 + s)*.4, P[s][2]] : P[s], col:() => o.brass ? 1 : 0, al:s => s < n ? 1 : 0 };
  },
  cards: () => {
    const w = Math.min(W*.86, 420), h = 58, gap = 14, cy = H*.3, rects = [0, 1, 2].map(i => ({ x:W/2 - w/2, y:cy + (i - 1)*(h + gap), w, h }));
    const per = Math.floor(N/3), P = [], C = [], links = [];
    rects.forEach((r, i) => { const loop = [[r.x, r.y - h/2], [r.x + w, r.y - h/2], [r.x + w, r.y + h/2], [r.x, r.y + h/2]].map(q => [q[0] - W/2, cy - q[1]]);
      const start = P.length; resample(loop, per).forEach((q, j) => { P.push([q[0], q[1], 0]); C.push(i === 0 ? 1 : 0); links.push([start + j, start + (j + 1) % per, i === 0 ? 1 : .6]); }); });
    const n = P.length; while(P.length < N){ P.push([0, 0, 0]); C.push(0); }
    return { cx:W/2, cy, spin:0, rate:0, pitch:0, links, rects, at:s => P[s], col:s => C[s], al:s => s < n ? .8 : 0 };
  },
  dot: o => ({ cx:o.x, cy:o.y, spin:0, rate:0, pitch:0, links:[], at:s => [Math.cos(s)*2*(s % 3), Math.sin(s*1.7)*2*(s % 3), 0], col:() => o.brass ? 1 : 0, al:() => 1 }),
  check: () => {
    const R = L.R0*1.15, pl = [[-.55, .02], [-.15, -.4], [.6, .42]], P = [];
    for(let s = 0; s < N; s++){ const k = s/N, seg = k < .3 ? 0 : 1, u = seg ? (k - .3)/.7 : k/.3, a = pl[seg], b = pl[seg + 1];
      P.push([(a[0] + (b[0] - a[0])*u)*R + (Math.random() - .5)*3, (a[1] + (b[1] - a[1])*u)*R + (Math.random() - .5)*3, (Math.random() - .5)*6]); }
    return { cx:L.hx, cy:L.hy, spin:0, rate:0, pitch:0, links:[], at:s => P[s], col:() => 1, al:() => 1 };
  },
  window: r => {
    const loop = (pts) => pts.map(q => [q[0] - W/2, r.cy - q[1]]);
    const P = [], A = [], links = [];
    const addLine = (pts, n, al, closed) => { const s = P.length, rr = closed ? resample(loop(pts), n) : Array.from({length:n}, (_, j) => { const a = loop(pts)[0], b = loop(pts)[1], u = j/(n - 1); return [a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u]; });
      rr.forEach(q => { P.push([q[0], q[1], 0]); A.push(al); }); for(let j = 0; j < n - (closed ? 0 : 1); j++) links.push([s + j, s + (j + 1) % n, al]); };
    addLine([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], 380, 1, true);
    for(const yy of r.seps) addLine([[r.x + 12, yy], [r.x + r.w - 12, yy]], 70, .45, false);
    const n = P.length; while(P.length < N){ P.push([0, 0, 0]); A.push(0); }
    return { cx:W/2, cy:r.cy, spin:0, rate:0, pitch:0, links, at:s => P[s], col:() => 0, al:s => A[s] };
  },
  derm: () => {
    const [gx, g0] = ground(), gy = g0 - H*.08, S = Math.min(W*.42, 320), P = [], A = [], C = [], links = [];
    const add = (pts, closed, al, col = 0) => { const s = P.length; pts.forEach(q => { P.push([q[0]*S, q[1]*S, q[2]*S]); A.push(al); C.push(col); });
      for(let j = 0; j < pts.length - (closed ? 0 : 1); j++) links.push([s + j, s + (j + 1) % pts.length, al]); };
    const line = (a, b, n) => Array.from({length:n}, (_, j) => { const u = j/(n - 1); return [a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u]; });
    const ring = (x, y, z, r, n, plane = "xz") => Array.from({length:n}, (_, j) => { const a = j/n*Math.PI*2; return plane === "xz" ? [x + Math.cos(a)*r, y, z + Math.sin(a)*r] : [x, y + Math.cos(a)*r, z + Math.sin(a)*r]; });
    const cyl = (x, z, r, h, n, v, al) => { add(ring(x, 0, z, r, n), true, al*.6); add(ring(x, h, z, r, n), true, al); for(let k = 0; k < v; k++){ const a = k/v*Math.PI*2; add(line([x + Math.cos(a)*r, 0, z + Math.sin(a)*r], [x + Math.cos(a)*r, h, z + Math.sin(a)*r], 5), false, al*.5); } };
    add(line([-1.02, .05, 0], [.95, .05, 0], 70), false, .7);
    add(ring(-.95, .05, 0, .045, 14, "yz"), true, .9);
    cyl(-.66, 0, .07, .22, 22, 6, 1);
    const bx = -.22, bw = .17, bd = .11, bh = .22;
    const c8 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, k]) => [bx + i*bw, k*bd]);
    add(c8.map(q => [q[0], 0, q[1]]), true, .6); add(c8.map(q => [q[0], bh, q[1]]), true, 1);
    c8.forEach(q => add(line([q[0], 0, q[1]], [q[0], bh, q[1]], 6), false, .5));
    for(const xx of [bx - bw*.35, bx + bw*.35]) add([[xx, .02, -bd], [xx, bh*.85, -bd], [xx, bh*.85, bd], [xx, .02, bd]], true, .35);
    cyl(.18, -.065, .045, .2, 16, 4, 1); cyl(.18, .065, .045, .2, 16, 4, 1);
    cyl(.5, 0, .04, .16, 16, 4, .9);
    add(ring(.7, .05, 0, .045, 14, "yz"), true, .9);
    add(ring(.86, .05, 0, .075, 30, "yz"), true, 1, 1);
    add(line([.86, -.02, -.06], [.86, .12, .06], 10), false, 1, 1);
    const n = Math.min(P.length, N); P.length = Math.max(P.length, N);
    for(let s = n; s < N; s++){ P[s] = [0, 0, 0]; A[s] = 0; C[s] = 0; }
    const ls = links.filter(l => l[0] < N && l[1] < N);
    return { cx:gx, cy:gy, spin:0, yaw0:-.3, rate:0, pitch:.5, links:ls, S, width:2.1*S, height:.5*S, at:s => P[s], al:s => A[s], col:s => C[s] };
  },
  tower: hot => {
    const Tw = DATA.tower, F = Tw.floors.length, per = Math.floor(N/F), [gx, gy] = ground();
    const S = Math.min(W*.34, (gy - Math.max(70, H*.1))/(F*Tw.fh + .4));
    const ring = {}; for(const k in Tw.shapes) ring[k] = resample(Tw.shapes[k], per);
    const P = [], C = [], A = [];
    for(let s = 0; s < N; s++){ const f = Math.floor(s/per), j = s % per;
      if(f >= F){ P.push([0, 0, 0]); C.push(0); A.push(0); continue; }
      const q = ring[Tw.floors[f][1]][j]; P.push([q[0]*S, (f*Tw.fh + Tw.fh*.85)*S, q[1]*S]); C.push(f === hot ? 1 : 0); A.push(f === hot ? 1 : .72); }
    const links = [];
    for(let f = 0; f < F; f++) for(let j = 0; j < per; j++){ const s = f*per + j; links.push([s, f*per + (j + 1) % per, f === hot ? 1 : .5]); if(f < F - 1 && j % 6 === 0) links.push([s, s + per, .2]); }
    return { cx:gx, cy:gy, spin:1, rate:.2, pitch:.22, links, S, per, hot, at:s => P[s], col:s => C[s], al:s => A[s], width:S*2, height:(F*Tw.fh + .1)*S };
  },
  site: () => {
    const Ls = DATA.site.loops, [gx, gy] = ground(), S = Math.min(W*.44, H*.26), EX = 2.6;
    const per = Ls.map(l => perim(l.pts)), tot = per.reduce((a, b) => a + b, 0)*2, budget = N - 20;
    const P = [], B = [], A = [], links = [];
    Ls.forEach((l, li) => { const n = Math.max(8, Math.round(per[li]*2/tot*budget/2));
      for(const [lev, al] of [[0, .45], [l.h*EX, 1]]){ const start = P.length;
        resample(l.pts, n).forEach((q, j) => { P.push([q[0]*S, lev*S, q[1]*S]); B.push(l.b); A.push(al); links.push([start + j, start + (j + 1) % n, al*.8]); }); }
      const g0 = P.length - 2*n; for(let j = 0; j < n; j += 3) links.push([g0 + j, g0 + n + j, .25]); });
    while(P.length < N){ P.push([0, 0, 0]); B.push(""); A.push(0); }
    const sh = { cx:gx, cy:gy, spin:1, rate:.08, pitch:.9, S, EX, links, hot:"", hotK:0, width:S*2, height:S*.4,
      at:s => P[s], al:s => A[s], col(s){ return B[s] && B[s] === sh.hot ? sh.hotK : 0; } };
    return sh;
  }
};
function project(x, y, z, cx, cy, yaw, pitch){
  const c = Math.cos(yaw), s = Math.sin(yaw), x1 = x*c - z*s, z1 = x*s + z*c;
  const y2 = y*Math.cos(pitch) - z1*Math.sin(pitch), z2 = y*Math.sin(pitch) + z1*Math.cos(pitch), f = D/(D + z2);
  return [cx + x1*f, cy - y2*f, f];
}
function become(name, arg, dur = 900){
  const sh = SH[name](arg), t = performance.now(), tt = t/1000;
  cur = sh; cur.name = name; linkTarget = 0;
  const key = s => sh.cy - sh.at(s, tt)[1] + (sh.al(s) ? 0 : 1e5);
  const slots = Array.from({length:N}, (_, s) => s).sort((a, b) => key(a) - key(b));
  const order = pts.slice().sort((a, b) => a.Y - b.Y);
  const spread = T(dur*.35), each = T(dur*.65);
  order.forEach((p, k) => { Object.assign(p, { sx:p.x, sy:p.y, sz:p.z, scx:p.cx, scy:p.cy, syaw:p.yaw, spi:p.pi, scol:p.col, sal:p.al });
    p.slot = slots[k]; inv[p.slot] = p.i; p.t0 = t + k/N*spread; p.dur = Math.max(1, each); });
  return new Promise(r => setTimeout(() => { linkTarget = sh.links.length ? 1 : 0; r(sh); }, T(dur)));
}

/* ---------- messengers ---------- */
let msgs = [], marks = [];
function bez(m, e){ const [tx, ty] = m.to(), mx = (m.fx + tx)/2, my = (m.fy + ty)/2, dx = tx - m.fx, dy = ty - m.fy, l = Math.hypot(dx, dy) || 1;
  const cx = mx - dy/l*m.bend, cy = my + dx/l*m.bend, i = 1 - e; return [i*i*m.fx + 2*i*e*cx + e*e*tx, i*i*m.fy + 2*i*e*cy + e*e*ty]; }
function send(fx, fy, to, n, dur, onLand){
  if(RM){ onLand?.(); return; }
  const t = performance.now(); for(let i = 0; i < n; i++) msgs.push({ fx, fy, to, t0:t + Math.random()*T(90), dur:T(dur*(.85 + Math.random()*.3)), bend:(Math.random() - .5)*90, onLand:i === n - 1 ? onLand : null });
}

/* ---------- frame ---------- */
let followers = [], last = performance.now();
function frame(now){
  if(!alive) return;
  const t = now/1000, dt = Math.min(.05, (now - last)/1000); last = now;
  if(!RM) rot += dt*(cur ? cur.rate : .25);
  linkA += (linkTarget - linkA)*(RM ? 1 : .08);
  voiceSmooth += (voice - voiceSmooth)*.3; kick *= .965;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const gl = g.createRadialGradient(W/2, H*.4, 0, W/2, H*.4, Math.max(W, H)*.75);
  gl.addColorStop(0, `rgba(36,84,138,${.2 + voiceSmooth*.08})`); gl.addColorStop(1, "rgba(4,7,12,0)"); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  drawMesh(t);
  const sh = cur;
  // holographic light from the mesh up through the object
  if(spot.k > .02 && sh.width){
    const [gx, gy] = [sh.cx, sh.cy], w = sh.width*.55, h = sh.height*1.05;
    const gr = g.createLinearGradient(0, gy, 0, gy - h); gr.addColorStop(0, `rgba(147,208,240,${.09*spot.k})`); gr.addColorStop(.6, `rgba(147,208,240,${.025*spot.k})`); gr.addColorStop(1, "rgba(147,208,240,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(gx - w, gy); g.quadraticCurveTo(gx, gy + w*.18, gx + w, gy); g.lineTo(gx + w*.25, gy - h); g.lineTo(gx - w*.25, gy - h); g.closePath(); g.fill();
    const eg = g.createRadialGradient(gx, gy, 0, gx, gy, w); eg.addColorStop(0, `rgba(147,208,240,${.16*spot.k})`); eg.addColorStop(1, "rgba(147,208,240,0)");
    g.save(); g.translate(gx, gy); g.scale(1, .28); g.translate(-gx, -gy); g.fillStyle = eg; g.beginPath(); g.arc(gx, gy, w, 0, 7); g.fill(); g.restore();
  }
  for(const p of pts){
    const [tx, ty, tz] = sh.at(p.slot, t), k = clamp((now - p.t0)/p.dur), e = ease(k);
    p.x = lerp(p.sx, tx, e); p.y = lerp(p.sy, ty, e); p.z = lerp(p.sz, tz, e);
    p.cx = lerp(p.scx, sh.cx, e); p.cy = lerp(p.scy, sh.cy, e); p.pi = lerp(p.spi, sh.pitch, e);
    p.col = lerp(p.scol, sh.col(p.slot), e); p.al = lerp(p.sal, sh.al(p.slot), e);
    p.yaw = p.syaw + wrap((sh.spin ? rot : (sh.yaw0 || 0)) - p.syaw)*e;
    const pr = project(p.x, p.y, p.z, p.cx, p.cy, p.yaw, p.pi); p.X = pr[0]; p.Y = pr[1]; p.F = pr[2];
  }
  if(linkA > .01){
    const groups = {};
    for(const lk of sh.links){ const a = pts[inv[lk[0]]], b = pts[inv[lk[1]]];
      const al = Math.round(lk[2]*linkA*(.4 + .6*clamp((a.F - .9)*5))*(1 + voiceSmooth*.3)*10)/10; if(al <= 0) continue;
      const key = (a.col > .5 ? "b" : "s") + Math.min(1, al); (groups[key] ||= []).push(a.X, a.Y, b.X, b.Y); }
    for(const key in groups){ const Lg = groups[key], c = key[0] === "b" ? BRASS : SKY; g.strokeStyle = `rgba(${c},${+key.slice(1)*.85})`; g.beginPath();
      for(let j = 0; j < Lg.length; j += 4){ g.moveTo(Lg[j], Lg[j + 1]); g.lineTo(Lg[j + 2], Lg[j + 3]); } g.stroke(); }
  }
  g.globalCompositeOperation = "lighter";
  for(const p of pts){
    if(p.al < .02) continue;
    const d = clamp((p.F - .93)*7), c0 = p.col;
    g.globalAlpha = p.al*(.25 + .75*d); g.fillStyle = `rgb(${lerp(SKY[0], BRASS[0], c0)|0},${lerp(SKY[1], BRASS[1], c0)|0},${lerp(SKY[2], BRASS[2], c0)|0})`;
    const s = 1.2 + d*.9; g.fillRect(p.X - s/2, p.Y - s/2, s, s);
  }
  if(sh.name === "site") for(const m of marks){
    if(!m.on) continue;
    const pr = project(m.x*sh.S, m.y*sh.S*sh.EX, m.z*sh.S, sh.cx, sh.cy, rot, sh.pitch); m.X = pr[0]; m.Y = pr[1];
    const hot = sh.hot && m.b === sh.hot ? sh.hotK : 0, dim = sh.hot && m.b !== sh.hot ? 1 - .6*sh.hotK : 1;
    g.globalAlpha = .9*dim; g.fillStyle = hot > .5 ? "rgb(201,163,92)" : "rgb(147,208,240)"; g.beginPath(); g.arc(m.X, m.Y, 1.8 + hot*.6, 0, 7); g.fill();
    if(m.flash > .02){ g.globalAlpha = m.flash*.8; g.strokeStyle = "rgb(147,208,240)"; g.lineWidth = 1; g.beginPath(); g.arc(m.X, m.Y, 2 + (1 - m.flash)*9, 0, 7); g.stroke(); m.flash *= .9; }
  }
  msgs = msgs.filter(m => { const k = (now - m.t0)/m.dur; if(k < 0) return true; if(k >= 1){ m.onLand?.(); return false; }
    const e = ease(k), [x, y] = bez(m, e), [x2, y2] = bez(m, Math.max(0, e - .08));
    g.globalAlpha = .45*Math.sin(Math.PI*k) + .2; g.strokeStyle = "rgb(147,208,240)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x, y); g.stroke();
    g.globalAlpha = .9; g.fillStyle = "rgb(230,240,247)"; g.fillRect(x - 1, y - 1, 2, 2); return true; });
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  for(const fn of followers) fn(now);
  requestAnimationFrame(frame);
}

/* ---------- timing, voice and subtitles ---------- */
let skip = null;
const sleep = ms => new Promise(r => { const id = setTimeout(r, T(ms)); skip = () => { clearTimeout(id); r(); }; });
function tween(fn, ms, ez = easeOut){ const t0 = performance.now(), D2 = T(ms);
  return new Promise(res => { const step = n => { const k = D2 ? clamp((n - t0)/D2) : 1; fn(ez(k)); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); }); }
function clearSubs(){ for(const el of [qEl, aEl]) el.animate([{opacity:1}, {opacity:0}], {duration:T(220), fill:"forwards"}); return sleep(230).then(() => { qEl.textContent = ""; aEl.textContent = ""; qEl.getAnimations().forEach(a => a.cancel()); aEl.getAnimations().forEach(a => a.cancel()); }); }
// Words appear as they are spoken. rate 1.5 matches ElevenLabs played at 1.5x.
async function speak(el, text, { rate = 1.5, own = true, onWord, append = false } = {}){
  if(append){ el.append(" "); el.setAttribute("aria-label", (el.getAttribute("aria-label") || "") + " " + text); } else { el.textContent = ""; el.setAttribute("aria-label", text); }
  const words = text.split(" ").map((w, i, a) => { const s = document.createElement("span"); s.className = "wd"; s.textContent = w; s.setAttribute("aria-hidden", "true"); el.append(s); if(i < a.length - 1) el.append(" "); return s; });
  for(const w of words){
    onWord?.(w.textContent);
    const d = (85 + w.textContent.length*44)/rate, t0 = performance.now();
    w.animate([{opacity:0, filter:"blur(4px)", transform:"translateY(3px)"}, {opacity:1, filter:"blur(0)", transform:"none"}], {duration:T(Math.min(160, d)), easing:"ease-out", fill:"forwards"});
    await new Promise(r => { const tick = n => { const k = (n - t0)/T(d);
      const lv = k >= 1 ? 0 : Math.pow(Math.sin(Math.PI*clamp(k)), .6)*(.6 + .4*Math.random());
      if(own) voice = lv; else listenLv = lv;
      if(k >= 1 || RM) return r(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const end = w.textContent.slice(-1);
    if(end === "," ) await sleep(150/rate); else if(".?!:".includes(end)) await sleep(280/rate);
  }
  voice = 0; listenLv = 0;
}
const usd = v => "$" + v.toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
function label(cls, html){ const el = document.createElement("div"); el.className = "lab " + cls; el.innerHTML = html; labels.append(el); return el; }
const show = (el, delay = 0) => el.animate([{opacity:0, filter:"blur(5px)"}, {opacity:1, filter:"blur(0)"}], {duration:T(450), delay:T(delay), easing:"ease-out", fill:"forwards"});

/* ---------- first launch: ÓNIX introduces itself and connects accounts ---------- */
const arcPts = (cx, cy, rx, ry, a0, a1, step = 12) => { const out = [], n = Math.max(2, Math.ceil(Math.abs(a1 - a0)/step)); for(let i = 0; i <= n; i++){ const a = (a0 + (a1 - a0)*i/n)*Math.PI/180; out.push([cx + Math.cos(a)*rx, cy + Math.sin(a)*ry]); } return out; };
const rectPts = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const ICON = {
  mail: [[rectPts(-1, .68, 1, -.68), true], [[[-1, .68], [0, -.04], [1, .68]], false]],
  cal: [[rectPts(-.9, .8, .9, -.85), true], [[[-.9, .42], [.9, .42]], false], [[[-.45, .98], [-.45, .62]], false], [[[.45, .98], [.45, .62]], false],
    [[[-.9, -.02], [.9, -.02]], false], [[[-.9, -.44], [.9, -.44]], false], [[[-.3, .42], [-.3, -.85]], false], [[[.3, .42], [.3, -.85]], false]],
  folder: [[[[-1, .62], [-.42, .62], [-.26, .42], [1, .42], [1, -.72], [-1, -.72]], true], [[[-1, .22], [1, .22]], false]],
  lock: [[rectPts(-.62, .08, .62, -.85), true], [arcPts(0, .08, .4, .5, 180, 0), false], [[[0, -.26], [0, -.52]], false]],
  check: [[[[-.62, .02], [-.16, -.42], [.66, .46]], false]],
  finger: [[[[0, -.62], [0, .02]], false], ...[.2, .4, .6, .8, 1].map(r => [[[-r*.78, -.2 - r*.5], ...arcPts(0, -.2, r*.78, r*.95, 180, 0), [r*.78, -.2 - r*.5]], false])]
};
// Many icons (and an optional rounded button frame) drawn by the orb's own points
SH.icons = o => {
  const items = o.items, cy0 = o.cy;
  const paths = [];
  for(const it of items){
    for(const [pts, closed] of ICON[it.k]) paths.push({ it, closed, pts:pts.map(q => [it.x + q[0]*it.s, it.y - q[1]*it.s]) });
  }
  if(o.frame){ const f = o.frame, r = f.h/2, pts = [...arcPts(f.x + r, f.y, r, r, 90, 270, 15), ...arcPts(f.x + f.w - r, f.y, r, r, 270, 450, 15)];
    paths.push({ it:{ col:o.frameCol || 0, al:.9 }, closed:true, pts }); }
  const lens = paths.map(p => perim(p.closed ? p.pts : [...p.pts, ...p.pts.slice().reverse()])/(p.closed ? 1 : 2));
  const total = lens.reduce((a, b) => a + b, 0), budget = N - 4, P = [], C = [], A = [], links = [];
  paths.forEach((p, k) => {
    const n = Math.max(4, Math.round(lens[k]/total*budget)), s0 = P.length;
    let rr;
    if(p.closed) rr = resample(p.pts, n);
    else { const out = []; const segs = []; let tot = 0; for(let i = 0; i < p.pts.length - 1; i++){ const a = p.pts[i], b = p.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, l]); tot += l; }
      for(let j = 0; j < n; j++){ let want = j/(n - 1)*tot; for(const [a, b, l] of segs){ if(want <= l || b === segs.at(-1)[1]){ const u = l ? Math.min(1, want/l) : 0; out.push([a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u]); break; } want -= l; } }
      rr = out; }
    rr.forEach(q => { P.push([q[0] - W/2, cy0 - q[1], 0, q[1]]); C.push(p.it); A.push(p.it.al ?? 1); });
    for(let j = 0; j < rr.length - (p.closed ? 0 : 1); j++) links.push([s0 + j, s0 + (j + 1) % rr.length, (p.it.al ?? 1)*.9]);
  });
  const n = P.length; while(P.length < N){ P.push([0, 0, 0, 0]); C.push({}); A.push(0); }
  return { cx:W/2, cy:cy0, spin:0, rate:0, pitch:0, links:links.filter(l => l[0] < N && l[1] < N),
    at:(s, t) => s < n ? [P[s][0], P[s][1] + Math.sin(t*1.6 + s*.3)*.35, 0] : [0, 0, 0],
    col(s){ const it = C[s]; if(!it || s >= n) return 0; if(it.scan && fp.on) return P[s][3] > fp.y ? 1 : 0; return it.col || 0; },
    al:s => A[s] };
};
const fp = { on:false, y:0 };


/* ---------- real controls drawn by the orb: fingerprint button, account trio, choices ---------- */
const ui = root.querySelector(".onx-ui");
function el(tag, cls, text){ const e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
function fadeOut(node, ms = 220){ if(!node) return Promise.resolve(); const a = node.animate([{opacity:getComputedStyle(node).opacity}, {opacity:0}], {duration:T(ms), fill:"forwards"}); return a.finished.catch(() => {}).then(() => node.remove()); }
function btnGeom(){ const w = Math.min(W*.82, 340), h = 66, x = (W - w)/2, y = H*.28; return { x, y, w, h, fx:x + 40, fs:21 }; }
const errorText = e => { const m = String(e?.message || e || "").trim(); return m ? m.slice(0, 120) : "That didn't work. Try again."; };

// A fingerprint button made of the orb's points. onTap runs inside the real click,
// so a sign-in popup is allowed. Resolves {ok:true, value} or {ok:false} for "Not now".
function confirmButton({ text, status = "Checking", done = "Done", onTap, secondary = "Not now" }){
  return new Promise(async resolve => {
    const g0 = btnGeom();
    await become("icons", { cy:g0.y, frame:{ x:g0.x, y:g0.y, w:g0.w, h:g0.h }, items:[{ k:"finger", x:g0.fx, y:g0.y, s:g0.fs, scan:true }] }, 800);
    const btn = el("button", "onx-pill"); btn.type = "button";
    btn.style.cssText = `left:${g0.x}px;top:${g0.y - g0.h/2}px;width:${g0.w}px;height:${g0.h}px`;
    const label = el("span", "onx-pill-text", text); btn.append(label); btn.setAttribute("aria-label", text);
    const statusEl = el("p", "onx-status"); statusEl.setAttribute("role", "status"); statusEl.style.top = (g0.y + g0.h/2 + 14) + "px";
    const sec = secondary ? el("button", "onx-link", secondary) : null; if(sec){ sec.type = "button"; sec.style.top = (g0.y + g0.h/2 + 44) + "px"; }
    ui.append(btn, statusEl); if(sec) ui.append(sec);
    show(btn); if(sec) show(sec, 200);
    btn.focus({ preventScroll:true });
    let busy = false;
    const finish = async value => { await Promise.all([fadeOut(btn), fadeOut(statusEl), fadeOut(sec)]); resolve(value); };
    if(sec) sec.addEventListener("click", () => { if(!busy) finish({ ok:false }); });
    btn.addEventListener("click", () => {
      if(busy) return; busy = true;
      let p; try { p = Promise.resolve(onTap ? onTap() : null); } catch(e){ p = Promise.reject(e); }
      ripple(g0.fx, g0.y); kick = .35;
      statusEl.textContent = status; statusEl.classList.remove("err"); show(statusEl);
      let pending = true, result, error;
      p.then(v => { result = v; }, e => { error = e; }).finally(() => { pending = false; });
      (async () => {
        fp.on = true; const top = g0.y - g0.fs*1.05, bot = g0.y + g0.fs*.75; fp.y = bot;
        const line = () => { if(!fp.on) return; g.save(); g.globalAlpha = .9; g.strokeStyle = "rgb(147,208,240)"; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(g0.fx - g0.fs*1.1, fp.y); g.lineTo(g0.fx + g0.fs*1.1, fp.y); g.stroke(); g.restore(); };
        followers.push(line);
        const until = performance.now() + T(1300);
        while(alive && (pending || performance.now() < until)){ await tween(e => fp.y = lerp(bot, top, e), 500, ease); await tween(e => fp.y = lerp(top, bot, e), 420, ease); }
        followers = followers.filter(f => f !== line); fp.on = false;
        if(error){ statusEl.textContent = errorText(error); statusEl.classList.add("err"); busy = false; return; }
        await become("icons", { cy:g0.y, frame:{ x:g0.x, y:g0.y, w:g0.w, h:g0.h }, frameCol:1, items:[{ k:"check", x:g0.fx, y:g0.y, s:g0.fs, col:1 }] }, 420);
        kick = .9; label.textContent = done; btn.setAttribute("aria-label", done); statusEl.textContent = "";
        await sleep(850);
        finish({ ok:true, value:result });
      })();
    });
  });
}
function ripple(x, y){
  const r = el("i", "onx-ripple"); r.style.cssText = `left:${x}px;top:${y}px`; ui.append(r);
  r.animate([{transform:"translate(-50%,-50%) scale(.3)", opacity:.9}, {transform:"translate(-50%,-50%) scale(2.4)", opacity:0}], {duration:T(650), easing:"ease-out"}).finished.catch(() => {}).then(() => r.remove());
}

// Up to three account icons in a row, each with its name and state under it.
const trioLabs = [0, 1, 2].map(() => { const e = label("under", "<b></b><span></span>"); e.style.opacity = 0; return e; });
function trioGeom(){ const gap = Math.min(W*.29, 124), s = Math.min(W*.095, 38); return { y:H*.27, s, xs:[W/2 - gap, W/2, W/2 + gap] }; }
async function trio(cards, dur = 900){
  const t = trioGeom(), items = [];
  cards.forEach((c, i) => {
    if(c.state === "locked"){ items.push({ k:c.icon, x:t.xs[i], y:t.y, s:t.s, al:.22 }); items.push({ k:"lock", x:t.xs[i] + t.s*.9, y:t.y + t.s*.75, s:t.s*.42, col:1 }); }
    else items.push({ k:c.icon, x:t.xs[i], y:t.y, s:t.s, col:c.state === "on" ? 1 : 0, al:c.state === "off" ? .35 : 1 });
  });
  await become("icons", { cy:t.y, items }, dur);
  trioLabs.forEach((e, i) => { const c = cards[i]; if(!c){ e.style.opacity = 0; return; }
    e.querySelector("b").textContent = c.name;
    const sp = e.querySelector("span"); sp.textContent = c.state === "on" ? "Connected" : c.state === "locked" ? "Locked" : "Not connected";
    sp.style.color = c.state === "on" ? "var(--brass)" : "";
    e.style.left = t.xs[i] + "px"; e.style.top = (t.y + t.s + 14) + "px"; show(e); });
}
const hideTrio = () => trioLabs.forEach(e => e.animate([{opacity:getComputedStyle(e).opacity}, {opacity:0}], {duration:T(220), fill:"forwards"}));

// One big icon with a caption under it.
let iconCap = null;
async function bigIcon(kind, caption){
  const t = trioGeom();
  const p = become("icons", { cy:t.y, items:[{ k:kind, x:W/2, y:t.y, s:t.s*1.7 }] }, 1000);
  if(iconCap) iconCap.remove();
  iconCap = label("under", "<b></b>"); iconCap.querySelector("b").textContent = caption;
  iconCap.style.left = (W/2) + "px"; iconCap.style.top = (t.y + t.s*1.7 + 14) + "px";
  await p; show(iconCap);
}
const hideIcon = () => { if(iconCap){ const c = iconCap; iconCap = null; fadeOut(c); } };

// The user's name, written by the orb's points, with a quiet line under it.
let nameCap = null;
async function nameplate(name, line){
  const at = { cx:W/2, cy:H*.25, w:W*.8, h:H*.085 };
  await become("glyph", { text:String(name || "").toUpperCase().slice(0, 14), ...at }, 1000);
  if(nameCap) nameCap.remove();
  nameCap = label("under", "<span></span>"); nameCap.querySelector("span").textContent = line || "";
  nameCap.style.left = (W/2) + "px"; nameCap.style.top = (at.cy + at.h*.55 + 12) + "px"; show(nameCap); kick = .5;
}
const hideName = () => { if(nameCap){ const c = nameCap; nameCap = null; fadeOut(c); } };

// Large choice buttons under the subtitle area. Resolves with the chosen value.
function choose(options){
  return new Promise(resolve => {
    const row = el("div", "onx-choices");
    options.forEach((o, i) => { const b = el("button", "onx-choice" + (o.primary ? " primary" : ""), o.label); b.type = "button";
      b.addEventListener("click", async () => { row.querySelectorAll("button").forEach(x => x.disabled = true); await fadeOut(row); resolve(o.value); });
      row.append(b); });
    ui.append(row); show(row); row.querySelector("button")?.focus({ preventScroll:true });
  });
}
// A one-line text field with a Save button. Resolves with the text, or "" if skipped.
function ask({ placeholder = "", value = "", button = "Save", skip = "Skip" } = {}){
  return new Promise(resolve => {
    const f = el("form", "onx-choices onx-ask-form");
    const inp = el("input", "onx-input"); inp.type = "text"; inp.maxLength = 24; inp.value = value; inp.placeholder = placeholder;
    inp.autocomplete = "nickname"; inp.setAttribute("autocapitalize", "words"); inp.setAttribute("aria-label", placeholder || "Your answer");
    const ok = el("button", "onx-choice primary", button); ok.type = "submit";
    const no = el("button", "onx-choice", skip); no.type = "button";
    const done = async v => { f.querySelectorAll("button,input").forEach(x => x.disabled = true); inp.blur(); await fadeOut(f); resolve(v); };
    f.addEventListener("submit", e => { e.preventDefault(); if(inp.value.trim()) done(inp.value.trim()); else inp.focus(); });
    no.addEventListener("click", () => done(""));
    f.append(inp, ok, no); ui.append(f); show(f); inp.focus({ preventScroll:true });
  });
}
// A full-screen tap target. iPhones only allow speech after the first touch.
function tapToStart(text){
  return new Promise(resolve => {
    const b = el("button", "onx-wake"); b.type = "button"; b.setAttribute("aria-label", text);
    const hint = el("span", "onx-wake-hint", text); b.append(hint); ui.append(b); show(hint, 400);
    b.addEventListener("click", () => { b.disabled = true; fadeOut(b, 200); resolve(); }, { once:true });
  });
}

become("orb", null, 0);
requestAnimationFrame(frame);
/* ---------- home views: a week on the mesh, a list of cards, a big number ---------- */
// labels: 7 day names; counts: events per day (rise as bars); hot: index of the day being talked about.
async function week({ labels = [], counts = [], hot = 0 } = {}){
  cal.labs.forEach((e, i) => { e.querySelector("span").textContent = labels[i] || ""; });
  cal.hotIdx = hot; cal.hot = 0;
  bars.forEach(b => b.lab?.remove());
  bars = counts.map((c, d) => { if(!(c > 0)) return null;
    const lab = label("", "<b></b>"); lab.querySelector("b").textContent = String(c); lab.style.opacity = 0;
    return { r0:2, c0:7 + d*3, h:0, to:Math.min(6, c)*12 + 8, lab }; }).filter(Boolean);
  cal.labs.forEach((e, i) => show(e, i*40));
  await tween(k => cal.k = k, 600);
  await tween(k => bars.forEach(b => b.h = b.to*k), 700, ease);
  bars.forEach((b, i) => show(b.lab, i*50));
  await tween(k => cal.hot = k, 400);
  kick = .4;
}
async function hideWeek(){
  bars.forEach(b => b.lab && fadeOut(b.lab, 180));
  cal.labs.forEach(e => e.animate([{opacity:getComputedStyle(e).opacity}, {opacity:0}], {duration:T(200), fill:"forwards"}));
  await tween(k => { cal.k = 1 - k; cal.hot = 1 - k; bars.forEach(b => b.h = b.to*(1 - k)); }, 450);
  bars = []; cal.k = 0;
}
// Up to three rows: { title, meta, hot }. The orb draws the frames; text goes in with textContent.
let listLabs = [];
async function list(items = []){
  hideList();
  const sh = await become("cards", null, 800);
  listLabs = sh.rects.map((r, i) => { const it = items[i]; if(!it) return null;
    const e = label("card" + (it.hot ? " hot" : ""), "<b></b><span></span>");
    e.querySelector("b").textContent = it.title || ""; e.querySelector("span").textContent = it.meta || "";
    e.style.left = (r.x + 16) + "px"; e.style.top = r.y + "px"; e.style.width = (r.w - 32) + "px"; show(e, i*90); return e; }).filter(Boolean);
}
function hideList(){ listLabs.forEach(e => fadeOut(e, 180)); listLabs = []; }

/* ---------- project scenes: the orb becomes the building, the treatment train, the site ---------- */
let sceneLabs = [], sceneFollow = [], flow = null;
function onScreen(sh, x, y, z){ return project(x*sh.S, y*sh.S, z*sh.S, sh.cx, sh.cy, sh.yaw0 || 0, sh.pitch); }
function sceneLabel(cls, title, sub){ const e = label(cls, "<b></b><span></span>"); e.querySelector("b").textContent = title || ""; e.querySelector("span").textContent = sub || ""; sceneLabs.push(e); return e; }
function follow(fn){ sceneFollow.push(fn); followers.push(fn); }
async function clearScene(){
  sceneLabs.forEach(e => fadeOut(e, 180)); sceneLabs = [];
  followers = followers.filter(f => !sceneFollow.includes(f)); sceneFollow = [];
  marks = []; clearInterval(flow); flow = null;
  await tween(e => { spot.k = Math.min(spot.k, 1 - e); }, 400);
}
// floorName: the floor to light up, e.g. "Piso 2". note: { title, sub } next to it.
async function tower(floorName, note = {}){
  await clearScene();
  if(!DATA.tower) return false;
  const hot = DATA.tower.floors.findIndex(f => f[0] === floorName);
  const forming = become("tower", hot, 1400);
  tween(e => spot.k = e, 900);
  if(hot >= 0 && note.title){
    const lab = sceneLabel("side", note.title, note.sub);
    follow(() => { const sh = cur; if(sh.name !== "tower") return; let best = null, left = null;
      for(let j = 0; j < sh.per; j++){ const p = pts[inv[sh.hot*sh.per + j]]; if(!best || p.X > best.X) best = p; if(!left || p.X < left.X) left = p; }
      const lw = lab.offsetWidth || 110; let x = best.X + 14; if(x + lw > W - 12) x = Math.max(12, left.X - 14 - lw);
      lab.style.left = x + "px"; lab.style.top = best.Y + "px"; });
    forming.then(() => show(lab));
  }
  await forming; return true;
}
// stages: [[key, x, y, title, sub]], shown one by one every stepMs. The last one is the stop valve.
async function derm(stages, stepMs = 1300){
  await clearScene();
  const sh = await become("derm", null, 1400);
  tween(e => spot.k = e, 800);
  const labs = stages.map(([k, x, y, a, b], i) => { const el = sceneLabel((i === stages.length - 1 ? "valve " : "") + (y < 0 ? "day" : ""), a, b);
    follow(() => { if(cur !== sh) return; const p = onScreen(sh, x, y, 0), hw = (el.offsetWidth || 90)/2 + 8; el.style.left = clamp(p[0], hw, W - hw) + "px"; el.style.top = p[1] + "px"; }); return el; });
  const start = () => onScreen(sh, -1.02, .05, 0), stop = () => onScreen(sh, .8, .05, 0);
  if(!RM) flow = setInterval(() => { if(cur !== sh) return; const [fx, fy] = start(); msgs.push({ fx, fy, to:stop, t0:performance.now(), dur:T(1500), bend:0, onLand:null }); }, 110);
  for(const [i, el] of labs.entries()){ show(el); if(i === labs.length - 1) kick = .6; await sleep(stepMs); }
  return true;
}
// Barcelona: every NV5 mark flies to its spot; the building with the most lights up.
async function site(){
  await clearScene();
  if(!DATA.site) return null;
  const sh = await become("site", null, 1300);
  tween(e => spot.k = e, 700);
  marks = DATA.site.marks.map(m => ({ x:m[0], y:m[1], z:m[2], b:m[3], f:m[4], on:false, flash:0 }));
  const counter = sceneLabel("", "0", "repair marks"), cb = counter.querySelector("b"); let n = 0;
  counter.style.left = (W/2) + "px"; counter.style.top = Math.max(80, sh.cy - sh.S*.95) + "px"; show(counter);
  marks.forEach((m, i) => {
    const to = () => project(m.x*sh.S, m.y*sh.S*sh.EX, m.z*sh.S, sh.cx, sh.cy, rot, sh.pitch);
    if(RM){ m.on = true; n = marks.length; cb.textContent = n; return; }
    msgs.push({ fx:sh.cx, fy:sh.cy - H*.28, to, t0:performance.now() + T(i*14), dur:T(750), bend:(Math.random() - .5)*120, onLand:() => { m.on = true; m.flash = 1; cb.textContent = ++n; } });
  });
  await sleep(marks.length*14 + 800);
  const cnt = {}; marks.forEach(m => cnt[m.b] = (cnt[m.b] || 0) + 1);
  const top = Object.keys(cnt).filter(b => b !== "club").sort((a, b) => cnt[b] - cnt[a])[0];
  if(top && cur === sh){
    sh.hot = top; tween(e => sh.hotK = e, 700);
    const loop = DATA.site.loops.find(l => l.b === top);
    const lab = sceneLabel("", `Building ${top} · ${cnt[top]}`, "NV5 marks");
    if(loop) follow(() => { if(cur !== sh) return; const c = loop.pts.reduce((a, q) => [a[0] + q[0]/loop.pts.length, a[1] + q[1]/loop.pts.length], [0, 0]);
      const p = project(c[0]*sh.S, loop.h*sh.EX*sh.S, c[1]*sh.S, sh.cx, sh.cy, rot, sh.pitch); lab.style.left = p[0] + "px"; lab.style.top = Math.max(p[1] + 40, sh.cy + sh.S*.42) + "px"; });
    show(lab);
  }
  return { total:marks.length, byBuilding:cnt, top };
}
function setData(k, v){ DATA[k] = v; }

return {
  become, week, hideWeek, list, hideList, tower, derm, site, clearScene, setData, sleep, tween, show, label, send, clearSubs, trio, hideTrio, bigIcon, hideIcon, nameplate, hideName, choose, ask, tapToStart, confirmButton,
  say: (text, o = {}) => speak(aEl, text, { rate:1, ...o }),
  echo: text => speak(qEl, text, { rate:1.2, own:false }),
  setVoice(v){ voice = Math.max(0, Math.min(1, Number(v) || 0)); },
  setMode(m){ mode = m; },
  set kick(v){ kick = v; }, get kick(){ return kick; },
  set meshIn(v){ meshIn = v; }, get meshIn(){ return meshIn; },
  set scan(v){ scan = v; }, get scan(){ return scan; },
  spot, get W(){ return W; }, get H(){ return H; }, get calm(){ return RM; },
  ease, easeOut, lerp,
  destroy(){ alive = false; scope.removeEventListener("resize", layout); root.replaceChildren(); root.classList.remove("onx-root"); }
};
}
scope.OnixEngine = Object.freeze({ mount });
})(globalThis);
