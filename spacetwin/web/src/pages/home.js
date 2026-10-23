import { api, panoUrl } from '../api.js';
import { brand, brandMark } from '../brand.js';
import { formatArea, formatPrice, plural } from '../listing.js';
import { t } from '../i18n.js';
import { h, icon, toast } from '../ui.js';

export async function renderHome(app) {
  document.title = brand.name;
  const grid = h('div.space-grid');
  const page = h('main.home',
    h('header.home-header',
      h('div.brand', brandMark(), brand.name),
      h('div.home-actions',
        h('button.secondary', { onclick: loadSample }, 'Open sample'),
        h('button.primary', { onclick: create }, icon('plus'), 'New property'),
      ),
    ),
    h('section.home-intro',
      h('h1', brand.tagline),
      h('p', brand.pitch),
    ),
    grid,
    listingsSection(),
  );
  app.append(page);

  async function create() {
    try {
      const space = await api.createSpace('New property');
      location.hash = `#/space/${space.id}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function loadSample() {
    try {
      const space = await api.createSample();
      location.hash = `#/view/${space.id}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  let spaces;
  try {
    spaces = await api.listSpaces();
  } catch (err) {
    grid.append(h('p.empty', `Couldn’t load your properties: ${err.message}`));
    return;
  }
  if (!spaces.length) {
    grid.append(h('div.empty-card',
      h('h2', 'No properties yet'),
      h('p', 'Start a property and capture your first room with your phone, or open the sample flat to see what a finished tour looks like.'),
      h('div.row', h('button.secondary', { onclick: loadSample }, 'Open sample'), h('button.primary', { onclick: create }, 'New property')),
    ));
    return;
  }
  for (const s of spaces) {
    const cover = s.coverScanId
      ? h('img', { src: panoUrl(s.id)({ id: s.coverScanId, file: '' }), alt: '', loading: 'lazy' })
      : h('div.cover-empty', 'No 360° spots yet');
    const price = formatPrice(s.listing);
    const area = s.stats.totalArea > 0 ? formatArea(s.stats.totalArea).m2 : null;
    grid.append(h('article.space-card',
      h('a', { href: `#/view/${s.id}`, 'aria-label': `Open the tour of ${s.listing?.address || s.name}` }, h('div.cover', cover)),
      h('div.card-body',
        price ? h('p.meta.price', price) : null,
        h('h3', s.listing?.address || s.name),
        h('p.meta', [
          s.listing?.beds != null ? plural(s.listing.beds, 'bed') : null,
          area,
          plural(s.stats.scanCount, 'spot'),
        ].filter(Boolean).join(' · ')),
        h('div.card-actions',
          h('a.button.secondary.small', { href: `#/view/${s.id}` }, 'View tour'),
          h('a.button.ghost.small', { href: `#/space/${s.id}` }, icon('edit'), 'Edit'),
        ),
      ),
    ));
  }
}

/**
 * Listings published on verificasa.ro. Picking one starts its tour with the
 * listing's details filled in and goes straight to the camera; the finished
 * tour's link goes back into the listing's "Link Tur 3D" field.
 */
function listingsSection() {
  const list = h('div.space-grid.vc-listings', h('p.dim', t('Loading listings…')));
  const search = h('input', { type: 'search', placeholder: t('Search by title or neighbourhood'), 'aria-label': t('Search VerifiCasa listings') });
  const section = h('section.vc-section',
    h('div.vc-head',
      h('div', h('h2', t('Your VerifiCasa listings')), h('p.dim', t('Pick a listing to capture its 3D tour. Its price, address and contact come with it.'))),
      search),
    list);
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  load();
  return section;

  async function load() {
    let data, tours;
    try {
      [data, tours] = await Promise.all([api.verificasaListings(search.value), api.listSpaces()]);
    } catch (err) {
      list.replaceChildren(h('p.empty', t('VerifiCasa is not reachable right now ({error}).', { error: err.message })));
      return;
    }
    if (data.off) { section.remove(); return; }
    const byProperty = new Map(tours.filter((s) => s.verificasa).map((s) => [s.verificasa.propertyId, s]));
    if (!data.listings.length) {
      list.replaceChildren(h('p.empty', search.value ? t('No listing matches “{q}”.', { q: search.value }) : t('No published listings yet.')));
      return;
    }
    list.replaceChildren(...data.listings.map((l) => {
      const tour = byProperty.get(l.id);
      const price = formatPrice({ price: l.price, currency: l.currency });
      return h('article.space-card.vc-card',
        h('div.cover', l.image ? h('img.photo', { src: l.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : h('div.cover-empty', t('No photo'))),
        h('div.card-body',
          price ? h('p.meta.price', price, l.transaction === 'RENT' ? h('small', t(' / month')) : null) : null,
          h('h3', l.title),
          h('p.meta', [[l.zone, l.city].filter(Boolean).join(', '), l.rooms != null ? `${l.rooms} ${t('rooms')}` : null, l.surface ? `${l.surface} m²` : null].filter(Boolean).join(' · ')),
          h('div.card-actions',
            tour
              ? h('a.button.secondary.small', { href: `#/view/${tour.id}` }, t('View tour'))
              : h('button.primary.small', { onclick: (e) => start(l, e.currentTarget) }, icon('camera'), t('Create 3D tour')),
            tour ? h('a.button.ghost.small', { href: `#/capture/${tour.id}` }, icon('camera'), t('Add rooms')) : null,
            h('a.button.ghost.small', { href: l.url, target: '_blank', rel: 'noopener' }, t('Listing')),
          ),
        ),
      );
    }));
  }

  async function start(l, btn) {
    btn.disabled = true;
    try {
      const space = await api.spaceFromListing(l.id);
      location.hash = `#/capture/${space.id}`;
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }
}
