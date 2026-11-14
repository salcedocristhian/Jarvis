/* Gmail API read-only pilot. OAuth via Google Identity Services.
   Stores only the public OAuth client ID; access token exists in JS memory,
   never localStorage, URL params, Github or ElevenLabs agent tool inputs. */
(function (scope) {
  "use strict";
  const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
  let accessToken = "", expiresAt = 0, activeClient = "";
  let currentGrant = null;
  const ready = () => Boolean(accessToken && Date.now() < expiresAt - 60000);
  function isClientId(id) {
    return /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(String(id || "").trim());
  }
  function loadGIS() {
    if (scope.google?.accounts?.oauth2?.initTokenClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const element = document.getElementById("google-identity-services");
      if (element) {
        if (element.dataset.loaded === "true") return resolve();
        element.addEventListener("load", resolve, { once: true });
        element.addEventListener("error", () => reject(new Error("Google Identity Services no cargó.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true; script.defer = true;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error("No pude cargar Google Identity Services."));
      document.head.appendChild(script);
    });
  }
  async function connect(clientId) {
    const id = String(clientId || "").trim();
    if (!isClientId(id)) throw new Error("Primero configura un OAuth Client ID web de Google.");
    await loadGIS();
    if (currentGrant) throw new Error("La autorización de Gmail ya está en curso.");
    // Google controls the permission dialog, not the app.
    return new Promise((resolve, reject) => {
      currentGrant = { resolve, reject };
      const auth = scope.google.accounts.oauth2.initTokenClient({
        client_id: id, scope: GMAIL_SCOPE,
        callback: response => {
          const pending = currentGrant; currentGrant = null;
          if (response?.error || !response?.access_token) {
            pending?.reject(new Error(response?.error_description || response?.error || "No se autorizó Gmail."));
            return;
          }
          accessToken = response.access_token;
          activeClient = id;
          expiresAt = Date.now() + (Math.min(Number(response.expires_in) || 3600, 3600) * 1000);
          pending?.resolve({ connected: true });
        },
        error_callback: response => {
          const pending = currentGrant; currentGrant = null;
          pending?.reject(new Error(response?.message || response?.type || "La ventana de Google se cerró."));
        }
      });
      try { auth.requestAccessToken({ prompt: "" }); }
      catch (e) { currentGrant = null; reject(e); }
    });
  }
  async function request(path) {
    if (!ready()) throw new Error("Gmail no está autorizado en esta sesión. Pulsa Conectar Gmail en Ajustes.");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
      headers: { Authorization: "Bearer " + accessToken },
      cache: "no-store"
    });
    if (response.status === 401 || response.status === 403) {
      if (response.status === 401) { accessToken = ""; expiresAt = 0; }
      throw new Error("Google rechazó la sesión de Gmail (" + response.status + "). Reautoriza Gmail.");
    }
    if (!response.ok) throw new Error("La consulta de Gmail falló (" + response.status + ").");
    return response.json();
  }
  function header(message, name) {
    return (message?.payload?.headers || []).find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
  }
  function safeText(value, max = 200) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  async function messages(search = "in:inbox", limit = 20, pageToken = "") {
    const q = safeText(search, 180) || "in:inbox";
    const take = Math.min(50, Math.max(1, Number(limit) || 20));
    const suffix = pageToken ? "&pageToken=" + encodeURIComponent(String(pageToken).slice(0, 400)) : "";
    const page = await request("messages?maxResults=" + take + "&q=" + encodeURIComponent(q) + suffix);
    const messageIds = Array.isArray(page.messages) ? page.messages.slice(0, take) : [];
    // Fetch metadata in small groups to avoid overwhelming an iPhone connection.
    const details = [];
    for (let offset = 0; offset < messageIds.length; offset += 8) {
      const part = await Promise.all(messageIds.slice(offset, offset + 8).map(m =>
        request("messages/" + encodeURIComponent(m.id) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date")
      ));
      details.push(...part);
    }
    return { messages: details.map(d => ({
      id: String(d.id || ""), threadId: String(d.threadId || ""),
      from: safeText(header(d, "From"), 130), subject: safeText(header(d, "Subject"), 180),
      snippet: safeText(d.snippet, 230), date: safeText(header(d, "Date"), 75),
      unread: Array.isArray(d.labelIds) && d.labelIds.includes("UNREAD")
    })), query: q,
      nextPageToken: typeof page.nextPageToken === "string" ? page.nextPageToken : null,
      // Google's resultSizeEstimate is an ESTIMATE, not an exact count.
      countEstimate: Number.isInteger(page.resultSizeEstimate) ? page.resultSizeEstimate : null };
  }
  function decodeBody(part) {
    const data = part?.body?.data;
    if (!data || typeof atob !== "function") return "";
    const raw = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    try { return new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))); }
    catch { return raw; }
  }
  function collectBody(payload) {
    const stack = [payload], plain = [], html = [];
    while (stack.length) {
      const part = stack.pop();
      if (!part) continue;
      if (Array.isArray(part.parts)) for (const child of part.parts) stack.push(child);
      const body = decodeBody(part);
      if (!body) continue;
      if (part.mimeType === "text/plain") plain.push(body);
      else if (part.mimeType === "text/html") html.push(body);
    }
    if (plain.length) return plain.join("\n").trim();
    if (!html.length) return "";
    const markup = html.join("\n");
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(markup, "text/html");
      doc.querySelectorAll("script,style,noscript,iframe").forEach(n => n.remove());
      return (doc.body?.textContent || "").replace(/[ \t]+/g, " ").trim();
    }
    return markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  async function readMessage(id) {
    const msgId = String(id || "");
    if (!/^[a-zA-Z0-9_-]{3,120}$/.test(msgId)) throw new Error("Identificador de correo no válido.");
    const data = await request("messages/" + encodeURIComponent(msgId) + "?format=full");
    const body = collectBody(data.payload).slice(0, 18000);
    return { id: msgId, from: safeText(header(data,"From"), 160),
      subject: safeText(header(data,"Subject"), 200),
      date: safeText(header(data,"Date"), 95),
      body: body || safeText(data.snippet, 1500) || "Este correo no tiene cuerpo de texto visible.",
      hasAttachments: JSON.stringify(data.payload?.parts || []).includes('"filename":') };
  }
  function disconnect() {
    const token = accessToken;
    accessToken = ""; expiresAt = 0; activeClient = "";
    if (token && scope.google?.accounts?.oauth2?.revoke) scope.google.accounts.oauth2.revoke(token, () => {});
  }
  scope.JarvisGmail = Object.freeze({
    connect, messages, readMessage, disconnect, isClientId,
    get connected() { return ready(); },
    get clientId() { return activeClient; }
  });
})(globalThis);
