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
      try { auth.requestAccessToken({ prompt: "consent" }); }
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
  async function messages(search = "in:inbox", limit = 5) {
    const q = safeText(search, 160) || "in:inbox";
    const take = Math.min(6, Math.max(1, Number(limit) || 5));
    const page = await request("messages?maxResults=" + take + "&q=" + encodeURIComponent(q));
    const messageIds = Array.isArray(page.messages) ? page.messages.slice(0, take) : [];
    const details = await Promise.all(messageIds.map(m =>
      request("messages/" + encodeURIComponent(m.id) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date")
    ));
    return { messages: details.map(d => ({
      id: String(d.id || ""), threadId: String(d.threadId || ""),
      from: safeText(header(d, "From"), 110), subject: safeText(header(d, "Subject"), 130),
      snippet: safeText(d.snippet, 150), date: safeText(header(d, "Date"), 65),
      unread: Array.isArray(d.labelIds) && d.labelIds.includes("UNREAD")
    })), query: q, // resultSizeEstimate is approximate; never call it exact.
      countEstimate: Number.isInteger(page.resultSizeEstimate) ? page.resultSizeEstimate : null };
  }
  function disconnect() {
    const token = accessToken;
    accessToken = ""; expiresAt = 0; activeClient = "";
    if (token && scope.google?.accounts?.oauth2?.revoke) scope.google.accounts.oauth2.revoke(token, () => {});
  }
  scope.JarvisGmail = Object.freeze({
    connect, messages, disconnect, isClientId,
    get connected() { return ready(); },
    get clientId() { return activeClient; }
  });
})(globalThis);
