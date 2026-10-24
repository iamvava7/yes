// GDPR cookie consent store. Keeps a structured consent object in localStorage
// so the rest of the app can check whether a category is allowed before
// loading scripts (analytics, etc.). Versioned — bumping VERSION re-asks.
const KEY = "vc_cookie_consent";
const VERSION = 2;

export const defaultConsent = {
  necessary: true,
  functional: false,
  analytics: false,
  date: null,
  version: VERSION,
};

export function getConsent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.version !== VERSION) return null;
    return c;
  } catch {
    return null;
  }
}

export function setConsent(consent) {
  try {
    const c = { ...defaultConsent, ...consent, date: new Date().toISOString(), version: VERSION };
    localStorage.setItem(KEY, JSON.stringify(c));
    window.dispatchEvent(new CustomEvent("vc-cookie-consent", { detail: c }));
    return c;
  } catch {
    return null;
  }
}

export function hasConsent(category) {
  const c = getConsent();
  if (!c) return false;
  if (category === "necessary") return true;
  return !!c[category];
}

export function clearConsent() {
  try { localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new CustomEvent("vc-cookie-consent", { detail: null }));
}