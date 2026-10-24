// Read-only link to the verificasa.ro listings (a Base44 app). The website lets
// anyone read approved listings (Property has no read rule), so the same
// public REST endpoint its own pages use works here without a login:
//   GET {server}/api/apps/{appId}/entities/Property?q=<json>&sort=-created_date&limit=N
// Configure with VERIFICASA_APP_ID / VERIFICASA_API; VERIFICASA_SITE builds
// the listing links. VERIFICASA_API=off turns the link off (offline demos, tests).

const DEFAULTS = {
  api: 'https://base44.app',
  appId: '6a5ef7d63008cd71560dfe14', // the id in the site's public media URLs
  site: 'https://verificasa.ro',
};
const CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 10 * 1000;

export function verificasaConfig(env = process.env) {
  return {
    api: (env.VERIFICASA_API || DEFAULTS.api).replace(/\/$/, ''),
    appId: env.VERIFICASA_APP_ID || DEFAULTS.appId,
    site: (env.VERIFICASA_SITE || DEFAULTS.site).replace(/\/$/, ''),
  };
}

/** Listing fields the tour app uses, from a Base44 Property record. */
export function toListing(p, site) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const place = [p.zone, p.city].filter(Boolean).join(', ');
  return {
    id: String(p.id),
    title: String(p.title ?? '').slice(0, 200),
    url: `${site}/property/${encodeURIComponent(p.id)}`,
    price: num(p.price_monthly),
    currency: ['EUR', 'RON', 'GBP'].includes(p.currency) ? p.currency : 'EUR',
    transaction: p.transaction_type === 'SALE' ? 'SALE' : 'RENT',
    propertyType: p.property_type ?? null,
    city: p.city ?? null,
    zone: p.zone ?? null,
    address: [p.landmark, place].filter(Boolean).join(', ') || null,
    rooms: num(p.rooms),
    surface: num(p.surface_sqm),
    floor: p.floor ?? null,
    year: num(p.building_year),
    description: typeof p.description === 'string' ? p.description.slice(0, 4000) : null,
    image: Array.isArray(p.images) && typeof p.images[0] === 'string' ? p.images[0] : null,
    phone: p.phone ?? null,
    contactName: p.posted_by_name || p.owner_name || null,
    latitude: num(p.latitude),
    longitude: num(p.longitude),
    tourUrl: p.tour_3d_url || null,
    views: num(p.views_count),
    posterPlan: ['basic', 'pro', 'agent'].includes(p.poster_plan_override || p.poster_plan) ? (p.poster_plan_override || p.poster_plan) : null,
    sellerRole: p.seller_role === 'Agent' ? 'Agent' : p.seller_role ? 'Proprietar' : null,
    status: p.status ?? null,
  };
}

export function createVerificasaClient({ config = verificasaConfig(), fetchImpl = fetch } = {}) {
  const cache = new Map();

  async function get(pathAndQuery) {
    const hit = cache.get(pathAndQuery);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetchImpl(`${config.api}/api/apps/${config.appId}/entities/Property${pathAndQuery}`, {
        headers: { accept: 'application/json' }, signal: ctrl.signal,
      });
    } catch (err) {
      throw new Error(`cannot reach VerifiCasa (${err.name === 'AbortError' ? 'timed out' : err.message})`);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`VerifiCasa answered ${res.status}`);
    const data = await res.json();
    cache.set(pathAndQuery, { at: Date.now(), data });
    return data;
  }

  const off = config.api === 'off';
  return {
    config,
    off,
    /** Approved, active listings, newest first; `search` matches title, city or zone. */
    async listings({ search = '', limit = 60 } = {}) {
      if (off) return [];
      const q = { approval_status: 'APPROVED', status: 'Activ' };
      const params = new URLSearchParams({ q: JSON.stringify(q), sort: '-created_date', limit: String(limit) });
      const rows = await get(`?${params}`);
      const list = (Array.isArray(rows) ? rows : rows?.items ?? []).map((p) => toListing(p, config.site));
      const needle = search.trim().toLowerCase();
      return needle ? list.filter((l) => [l.title, l.city, l.zone, l.address].some((v) => v?.toLowerCase().includes(needle))) : list;
    },
    async listing(id) {
      if (off) return null;
      const row = await get(`/${encodeURIComponent(id)}`);
      return row ? toListing(row, config.site) : null;
    },
  };
}

/**
 * The same listings read straight from the website's database, now that the
 * website runs on this server. Only what a visitor may see: approved, active.
 */
export function createLocalVerificasaClient(platform, { site = process.env.APP_URL || '' } = {}) {
  const base = site.replace(/\/$/, '');
  const props = () => platform.entities.handler('Property', { user: null });
  return {
    config: { api: 'local', site: base },
    off: false,
    async listings({ search = '', limit = 60 } = {}) {
      const rows = await props().filter({ approval_status: 'APPROVED', status: 'Activ' }, '-created_date', limit);
      const list = rows.map((p) => toListing(p, base));
      const needle = search.trim().toLowerCase();
      return needle ? list.filter((l) => [l.title, l.city, l.zone, l.address].some((v) => v?.toLowerCase().includes(needle))) : list;
    },
    async listing(id) {
      try {
        return toListing(await props().get(id), base);
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },
  };
}

/** Distance in metres between two latitude/longitude points (haversine). */
export function distanceMeters(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
