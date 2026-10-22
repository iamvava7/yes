import { bestScanForRoom, polygonArea } from '../../../shared/geometry.js';
import { api, exportUrl } from '../api.js';
import { formatArea, formatPrice, plural } from '../listing.js';
import { sfx, unlock } from '../sound.js';
import { h, icon } from '../ui.js';
import { createViewerChrome } from '../viewerChrome.js';

/**
 * The page you share: the walkable tour with the property's listing beside it
 * (a sheet that slides up on phones).
 */
export async function renderShowcase(app, id) {
  let space;
  try {
    space = await api.getSpace(id);
  } catch (err) {
    app.append(h('main.not-found', h('h1', 'Tour not found'), h('p', 'This link may be mistyped, or the tour was deleted.'), h('p.dim', err.message)));
    return null;
  }
  const listing = space.listing ?? {};
  const title = listing.address || space.name;
  document.title = `${title} · 3D tour`;

  const tourPane = h('section.tour-pane');
  const panel = h('aside.listing', { 'aria-label': 'Property details' });
  const root = h('div.showcase', tourPane, panel);
  app.append(root);

  const chrome = createViewerChrome(tourPane, id, { tools: ['measure'], spaceName: title });
  tourPane.append(h('header.tour-title',
    h('a.icon-btn', { href: `#/space/${id}`, title: 'Edit this tour' }, icon('edit')),
    h('div',
      listing.status ? h('span.status-chip', { dataset: { status: listing.status } }, listing.status) : null,
      h('strong', title),
    ),
  ));

  if (!space.scans.length) {
    tourPane.append(h('div.showcase-empty',
      h('h2', 'Nothing to tour yet'),
      h('p', 'This space has no 360° spots. Capture or upload some in the editor to build the tour.'),
      h('a.button.primary', { href: `#/space/${id}` }, 'Open editor'),
    ));
  }

  // ---------------------------------------------------------------- listing panel

  const price = formatPrice(listing);
  const area = formatArea(space.stats.totalArea);
  const facts = [
    listing.beds != null ? [icon('bed'), plural(listing.beds, 'bed')] : null,
    listing.baths != null ? [icon('bath'), plural(listing.baths, 'bath')] : null,
    space.stats.totalArea > 0 ? [icon('area'), area.m2, h('small', area.ft2)] : null,
  ].filter(Boolean);
  const goToRoom = (room) => {
    unlock();
    const scan = bestScanForRoom(room, space.scans);
    if (scan) chrome.viewer.goToScan(scan.id);
    sheet(false);
  };
  const contact = [
    listing.contactPhone ? h('a.button.secondary', { href: `tel:${listing.contactPhone.replace(/[^\d+]/g, '')}` }, icon('phone'), 'Call') : null,
    listing.contactEmail ? h('a.button.primary', { href: `mailto:${listing.contactEmail}?subject=${encodeURIComponent(title)}` }, icon('mail'), 'Email') : null,
  ].filter(Boolean);

  const handle = h('button.sheet-handle', { 'aria-label': 'Show property details', 'aria-expanded': false, onclick: () => { unlock(); sfx.tap(); sheet(!panel.classList.contains('open')); } });
  panel.append(
    handle,
    h('div.listing-head',
      price ? h('p.price', price) : null,
      h('h1.address', title),
      facts.length ? h('ul.facts-row', facts.map((f) => h('li', ...f))) : null,
    ),
    listing.description ? h('p.description', listing.description) : null,
    space.rooms.length ? h('section.listing-section',
      h('h2', 'Rooms'),
      h('ul.room-list', space.rooms.map((r) => {
        const a = polygonArea(r.points);
        return h('li', h('button', { onclick: () => goToRoom(r) },
          h('span.room-name', r.name),
          h('span.room-dims', `${a.toFixed(1)} m²`),
          h('span.room-height', `${r.height.toFixed(2)} m ceiling`),
        ));
      })),
    ) : null,
    space.rooms.length ? h('section.listing-section',
      h('h2', 'Floor plan'),
      h('button.plan-thumb', { title: 'Open the floor plan view', onclick: () => { unlock(); chrome.viewer.setMode('floorplan'); sheet(false); } },
        h('img', { src: exportUrl(id, 'floorplan.svg'), alt: `Floor plan of ${title}`, loading: 'lazy' })),
      h('a.dim', { href: exportUrl(id, 'floorplan.svg'), target: '_blank', rel: 'noopener' }, 'Open full size'),
    ) : null,
    listing.contactName || contact.length ? h('section.listing-section.contact',
      h('h2', 'Contact'),
      listing.contactName ? h('p', listing.contactName) : null,
      contact.length ? h('div.row', contact) : null,
    ) : null,
    h('p.made-with', '3D tour made with SpaceTwin'),
  );

  function sheet(open) {
    panel.classList.toggle('open', open);
    handle.setAttribute('aria-expanded', open);
  }

  chrome.update(space);
  return () => chrome.dispose();
}
