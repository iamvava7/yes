// Chei API gestionate din Admin → Integrări (pe lângă variabilele din .env de pe server).
//
// De ce așa: cheile NU stau în repo și nu ajung niciodată în browser. Din
// panoul de administrare se pot adăuga/înlocui, dar în baza de date ajung doar
// criptate (AES-GCM) cu o cheie-mamă care trăiește numai pe server (.env)
// (INTEGRATIONS_MASTER_KEY). Fără cheia-mamă, rândurile din tabel sunt inutile
// — inclusiv pentru cineva care ar vedea baza de date.
//
// Ordinea la citire: întâi variabila de pe server cu același nume,
// apoi valoarea din panou. Așa nimic din ce funcționează azi nu se schimbă.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const MASTER_SECRET = "INTEGRATIONS_MASTER_KEY";

// Ce integrări folosește aplicația; panoul le arată mereu, chiar și goale.
export const KNOWN_INTEGRATIONS = [
  { name: "StripeSecretKey", label: "Stripe — cheie secretă (live)", test: "stripe", group: "Plăți" },
  { name: "StripePublic", label: "Stripe — cheie publică", group: "Plăți" },
  { name: "StripeWebhookSecret", label: "Stripe — secret webhook", group: "Plăți" },
  { name: "ANTHROPIC_API_KEY", label: "Claude (Anthropic) — asistentul Maria", test: "anthropic", group: "AI" },
  { name: "GOOGLE_MAPS_API_KEY", label: "Google Maps / Places", test: "google_maps", group: "Hărți" },
  { name: "Map", label: "CARTO basemaps (hartă)", group: "Hărți" },
  { name: "Verificasa", label: "Kiri Engine — scanare 3D", group: "3D" },
];

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;
export function validName(name) {
  return typeof name === "string" && NAME_RE.test(name);
}

function b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function aesKey(master) {
  if (!master || master.length < 16) throw new Error(`${MASTER_SECRET} lipsește sau e prea scurtă (minim 16 caractere).`);
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(master));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Criptează o valoare; întoarce { ciphertext, iv } în base64. */
export async function sealSecret(master, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(master), enc.encode(value));
  return { ciphertext: b64(new Uint8Array(data)), iv: b64(iv) };
}

/** Decriptează ce a produs sealSecret (aruncă dacă cheia-mamă e alta). */
export async function openSecret(master, { ciphertext, iv }) {
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(master), unb64(ciphertext));
  return dec.decode(data);
}

export function lastFour(value) {
  return value.length <= 8 ? "" : value.slice(-4);
}

/**
 * Valoarea unei chei pentru funcțiile de backend: variabila de pe server, altfel cea
 * salvată din panou. `svc` = base44.asServiceRole. Întoarce null dacă nu e.
 */
export async function getSecret(svc, secrets, name) {
  const fromEnv = secrets.get(name);
  if (fromEnv) return fromEnv;
  const master = secrets.get(MASTER_SECRET);
  if (!master) return null;
  try {
    const rows = await svc.entities.IntegrationSecret.filter({ name }, "-updated_date", 1);
    return rows?.[0] ? await openSecret(master, rows[0]) : null;
  } catch (_) {
    return null;
  }
}
