/* Secure client for Jarvis web research. No provider API keys in browser code.
 * The access token is entered locally and kept in memory only, never persisted. */
(() => {
  'use strict';
  const ENDPOINT = 'https://jarvis-research.salcedo-cristhian-2020.workers.dev/api/research';
  let token = '';
  const validURL = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
    catch (_) { return ''; }
  };
  function configure(next) {
    const value = String(next || '').trim();
    if (value && (value.length < 32 || value.length > 256)) throw Error('El acceso privado debe tener entre 32 y 256 caracteres.');
    token = value;
  }
  async function search({ question } = {}) {
    const q = String(question || '').trim().slice(0, 600);
    if (!token) return { ok: false, speech: 'La búsqueda web todavía no está habilitada. Debes activarla con el acceso privado en Ajustes.', grounded: false, sources: [] };
    if (q.length < 2) return { ok: false, speech: 'Necesito una pregunta para buscar.', grounded: false, sources: [] };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20000);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ question: q }),
        signal: ac.signal,
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok) return { ok: false, speech: String(data?.error || 'Búsqueda no disponible.').slice(0, 240), grounded: false, sources: [] };
      const sources = Array.isArray(data.sources) ? data.sources.slice(0, 6).map(s => ({ title: String(s.title || 'Fuente').slice(0, 120), url: validURL(s.url) })).filter(s => s.url) : [];
      const grounded = Boolean(data.grounded && sources.length);
      const answer = String(data.answer || '').slice(0, 3000);
      return { ok: true, speech: answer + (grounded ? '' : ' No pude confirmar fuentes verificables para esta respuesta.'), grounded, sources, model: String(data.model || '').slice(0, 60) };
    } catch (_) {
      return { ok: false, speech: 'La búsqueda de internet no está disponible. Revisa la conexión o el servicio privado.', grounded: false, sources: [] };
    } finally { clearTimeout(timer); }
  }
  window.JarvisWebResearch = Object.freeze({ configure, search, get configured() { return Boolean(token); }, endpoint: ENDPOINT });
})();
