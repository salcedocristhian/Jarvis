/* ElevenAgents browser bridge, 2026-11. No API keys in source.
   ElevenLabs agent is origin-restricted to salcedocristhian.github.io.
   JobTread is read locally by JarvisDirect; its grant key never enters agent settings. */
(() => {
  "use strict";
  const AGENT_ID = "agent_9601m7c4t540fh6v6nadake0hsrp";
  const SDK_URL = "https://esm.sh/@elevenlabs/client@1.36.0?bundle";
  let sdkPromise = null;
  let session = null;
  let connecting = false;

  function sdk() {
    if (!sdkPromise) sdkPromise = import(SDK_URL).catch(e => { sdkPromise = null; throw e; });
    return sdkPromise;
  }
  // Download only the public ElevenAgents SDK in the background. Do not request
  // microphone permission or start a call until the user touches the orb.
  function preload() { return sdk().then(() => true); }
  function getMessageText(m) {
    if (!m || typeof m !== "object") return "";
    const value = m.message || m.text || m.transcript || "";
    return typeof value === "string" ? value.trim().slice(0, 1600) : "";
  }
  function getSpeaker(m) {
    const source = String(m?.source || m?.role || m?.type || "").toLowerCase();
    if (/user|transcript/.test(source)) return "user";
    if (/ai|agent|assistant/.test(source)) return "agent";
    return "";
  }
  async function start({ clientTools = {}, dynamicVariables, signedUrl, onConnect, onDisconnect, onMessage, onModeChange, onError } = {}) {
    if (session || connecting) return session;
    connecting = true;
    try {
      // Ask for permission while executing the real user gesture; release the
      // temporary track before the SDK requests its own audio stream.
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("El navegador no permite usar el micrófono.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      const { Conversation } = await sdk();
      if (!Conversation?.startSession) throw new Error("No pude cargar el cliente de ElevenAgents.");
      const pending = await Conversation.startSession({
        // A private link from the ÓNIX server when it is set up; otherwise the public agent ID.
        ...(signedUrl ? { signedUrl } : { agentId: AGENT_ID }),
        connectionType: "websocket",
        clientTools,
        ...(dynamicVariables ? { dynamicVariables } : {}),
        onConnect: info => onConnect?.(info),
        onDisconnect: info => { session = null; onDisconnect?.(info); },
        onMessage: msg => onMessage?.({ text: getMessageText(msg), speaker: getSpeaker(msg), original: msg }),
        onModeChange: mode => onModeChange?.(mode),
        onError: error => onError?.(error),
      });
      session = pending;
      return session;
    } finally { connecting = false; }
  }
  async function stop() {
    if (!session) return;
    const current = session;
    session = null;
    await current.endSession();
  }
  // Quiet information for the agent (an action's result) that doesn't count as the person speaking.
  function context(text) {
    if (!session) return false;
    const t = String(text).slice(0, 800);
    if (typeof session.sendContextualUpdate === "function") session.sendContextualUpdate(t); else session.sendUserMessage("SYSTEM NOTE: " + t);
    return true;
  }
  function send(text) {
    if (!session) return false;
    session.sendUserMessage(String(text).slice(0, 1500));
    return true;
  }
  // Real output loudness of the agent's voice (0..1) and its frequency bands, for the orb ring.
  // Read-only calls on the SDK session; they never touch the microphone or the network.
  function level() {
    try { const v = session?.getOutputVolume?.(); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; } catch { return 0; }
  }
  function bands() {
    try { const d = session?.getOutputByteFrequencyData?.(); return d && d.length ? d : null; } catch { return null; }
  }
  window.JarvisElevenAgent = Object.freeze({
    start, stop, send, context, preload, level, bands, get connected() { return !!session; },
    get connecting() { return connecting; }, id: AGENT_ID
  });
})();
