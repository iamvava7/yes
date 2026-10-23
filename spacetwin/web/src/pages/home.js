import { api, panoUrl } from '../api.js';
import { brand, brandMark } from '../brand.js';
import { formatArea, formatPrice, plural } from '../listing.js';
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
