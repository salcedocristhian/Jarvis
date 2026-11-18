// ÓNIX settings. Public values only: client IDs are not secrets. Never put a secret, token or API key here.
window.ONIX_CONFIG = {
  name: "ÓNIX",
  // SHA-256 of each administrator's email, lowercase. Admins get the premium ElevenLabs voice without a daily cap
  // and see JobTread. Hashing keeps the address out of the public repo.
  // To add one: in a terminal, run   printf '%s' 'name@company.com' | shasum -a 256
  adminEmailHashes: ["192415de7da4a638b541cfd10a9ae75cd79a2d52463f27ee4bfa0629cb4565f2"],
  google: {
    // Web OAuth client from Google Cloud (the same one Jarvis already uses for Gmail).
    clientId: "177629728774-f6bbak14vnrn2ud6573dinaj1gt2suc6.apps.googleusercontent.com"
  },
  microsoft: {
    // Application (client) ID from Microsoft Entra. Empty = the Microsoft option says it is not set up yet.
    clientId: "",
    // "common" accepts work accounts from any company and personal Outlook accounts.
    tenant: "common"
  },
  worker: {
    // Your ÓNIX server on Cloudflare, e.g. "https://onix.your-name.workers.dev". Empty = phase 1 behavior.
    url: ""
  },
  voice: {
    // ElevenLabs Creator ($22) includes about 275 minutes a month. Admins are not capped.
    // Everyone else gets this many seconds of the premium voice per day on their phone.
    // Pilot with 10 people: 60 s each still leaves Chris most of the month.
    guestDailySeconds: 60
  }
};
