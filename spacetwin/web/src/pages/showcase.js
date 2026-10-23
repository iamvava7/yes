import { bestScanForRoom, polygonArea } from '../../../shared/geometry.js';
import { countLabel, lang, num, t } from '../i18n.js';
import { api, exportUrl } from '../api.js';
import { brand, brandMark } from '../brand.js';
import { formatArea, formatPrice } from '../listing.js';
import { sfx, unlock } from '../sound.js';
import { h, icon } from '../ui.js';
import { createViewerChrome } from '../viewerChrome.js';

/**
 * The page you share: the walkable tour with the property's listing beside it
 * (a sheet that slides up on phones).
 *
 * `embed` is the same tour without the listing, for pages that already show it:
 * the "Tur 3D" tab of a verificasa.ro listing loads it from verificasa.ro/3D/<id>.
 */
export async function renderShowcase(app, id, { embed = false } = {}) {
  let space;
  try {
    space = await api.getSpace(id);
  } catch (err) {
    app.append(h('main.not-found', h('h1', t('Tour not found')), h('p', t('This link may be mistyped, or the tour was deleted.')), h('p.dim', err.message)));
    return null;
  }
  const listing = space.listing ?? {};
  const title = listing.address || space.name;
  document.title = `${title} · ${t('3D tour')}`;

  const tourPane = h('section.tour-pane');
  const panel = h('aside.listing', { 'aria-label': t('Property details') });
  const root = h(embed ? 'div.showcase.embed' : 'div.showcase', tourPane, embed ? null : panel);
  app.append(root);

  const chrome = createViewerChrome(tourPane, id, { tools: ['measure'], spaceName: title });
  if (embed) {
    // the listing page around the frame already shows the title and details
    tourPane.append(h('a.embed-badge', { href: `${location.origin}/#/view/${id}`, target: '_blank', rel: 'noopener', title: t('Open the full tour') },
      brandMark(), h('span', t('3D tour')), icon('external')));
  } else {
    tourPane.append(h('header.tour-title',
      h('a.icon-btn', { href: `#/space/${id}`, title: t('Edit this tour') }, icon('edit')),
      h('div',
        listing.status ? h('span.status-chip', { dataset: { status: listing.status } }, t(listing.status)) : null,
        h('strong', title),
      ),
    ));
  }

  if (!space.scans.length) {
    tourPane.append(h('div.showcase-empty',
      h('h2', t('Nothing to tour yet')),
      h('p', t('This space has no 360° spots. Capture or upload some in the editor to build the tour.')),
      embed ? null : h('a.button.primary', { href: `#/space/${id}` }, t('Open editor')),
    ));
  }

  // ---------------------------------------------------------------- listing panel

  const price = formatPrice(listing);
  const area = formatArea(space.stats.totalArea);
  const facts = [
    listing.beds != null ? [icon('bed'), countLabel(listing.beds, 'bed')] : null,
    listing.baths != null ? [icon('bath'), countLabel(listing.baths, 'bath')] : null,
    space.stats.totalArea > 0 ? [icon('area'), area.m2, lang === 'en' ? h('small', area.ft2) : null] : null,
  ].filter(Boolean);
  const goToRoom = (room) => {
    unlock();
    const scan = bestScanForRoom(room, space.scans);
    if (scan) chrome.viewer.goToScan(scan.id);
    sheet(false);
  };
  const contact = [
    listing.contactPhone ? h('a.button.secondary', { href: `tel:${listing.contactPhone.replace(/[^\d+]/g, '')}` }, icon('phone'), t('Call')) : null,
    listing.contactEmail ? h('a.button.primary', { href: `mailto:${listing.contactEmail}?subject=${encodeURIComponent(title)}` }, icon('mail'), t('Email')) : null,
  ].filter(Boolean);

  const handle = h('button.sheet-handle', { 'aria-label': t('Show property details'), 'aria-expanded': false, onclick: () => { unlock(); sfx.tap(); sheet(!panel.classList.contains('open')); } });
  // Element.append would print a null as the text "null": drop the empty sections
  panel.append(...[
    handle,
    h('div.listing-head',
      price ? h('p.price', price) : null,
      h('h1.address', title),
      facts.length ? h('ul.facts-row', facts.map((f) => h('li', ...f))) : null,
    ),
    listing.description ? h('p.description', listing.description) : null,
    space.rooms.length ? h('section.listing-section',
      h('h2', t('Rooms')),
      h('ul.room-list', space.rooms.map((r) => {
        const a = polygonArea(r.points);
        return h('li', h('button', { onclick: () => goToRoom(r) },
          h('span.room-name', r.name),
          h('span.room-dims', `${num(a)} m²`),
          h('span.room-height', t('{h} m ceiling', { h: num(r.height, 2) })),
        ));
      })),
    ) : null,
    space.rooms.length ? h('section.listing-section',
      h('h2', t('Floor plan')),
      h('button.plan-thumb', { title: t('Open the floor plan view'), onclick: () => { unlock(); chrome.viewer.setMode('floorplan'); sheet(false); } },
        h('img', { src: exportUrl(id, 'floorplan.svg'), alt: t('Floor plan of {title}', { title }), loading: 'lazy' })),
      h('a.dim', { href: exportUrl(id, 'floorplan.svg'), target: '_blank', rel: 'noopener' }, t('Open full size')),
    ) : null,
    listing.contactName || contact.length ? h('section.listing-section.contact',
      h('h2', t('Contact')),
      listing.contactName ? h('p', listing.contactName) : null,
      contact.length ? h('div.row', contact) : null,
    ) : null,
    h('p.made-with', t('3D tour by '), h('a', { href: brand.site, target: '_blank', rel: 'noopener' }, brand.siteLabel)),
  ].filter(Boolean));

  function sheet(open) {
    panel.classList.toggle('open', open);
    handle.setAttribute('aria-expanded', open);
  }

  chrome.update(space);
  return () => chrome.dispose();
}
