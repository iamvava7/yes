import { pointInPolygon } from '../../../shared/geometry.js';
import { api, panoUrl } from '../api.js';
import { brand } from '../brand.js';
import { countLabel, lang, t } from '../i18n.js';
import { formatArea } from '../listing.js';
import { sfx, unlock } from '../sound.js';
import { h, icon, toast } from '../ui.js';
import { Viewer } from '../viewer/Viewer.js';

// The tour buyers see: the "Web · 3D Tour viewer" design in the VerifiCasa App
// Redesign (Figma). The panorama fills the screen; a details panel opens from
// the right (a card from the bottom on phones) with who captured the tour, the
// floor plan, room shortcuts and actions. `embed` is the same page inside a
// verificasa.ro listing (verificasa.ro/3D/<id>), which already shows the
// listing around the frame.

const ASSET = '/tour';
const img = (name, cls, size) => h(`img.${cls}`, { src: `${ASSET}/${name}`, alt: '', width: size, height: size, draggable: false });
const PLAN_BADGE = { basic: 'plan-basic.png', pro: 'plan-pro.png', agent: 'plan-agent.png' };
const PLAN_NAME = { basic: 'Basic', pro: 'Pro', agent: 'Agent' };

export async function renderShowcase(app, id, { embed = false } = {}) {
  let space;
  try {
    space = await api.getSpace(id);
  } catch (err) {
    app.append(h('main.not-found', h('h1', t('Tour not found')), h('p', t('This link may be mistyped, or the tour was deleted.')), h('p.dim', err.message)));
    return null;
  }

  const listing = space.listing ?? {};
  const vc = space.verificasa ?? null;
  const title = listing.address || vc?.title || space.name;
  document.title = `${title} · ${t('3D tour')}`;
  const pano = panoUrl(id);
  const captor = {
    name: listing.contactName || vc?.posterName || null,
    plan: PLAN_BADGE[vc?.posterPlan] ? vc.posterPlan : null,
    role: vc?.sellerRole === 'Agent' ? t('Agent') : vc?.sellerRole ? t('Owner') : null,
  };
  const listingUrl = vc?.url ?? null;
  const contactHref = listing.contactPhone ? `tel:${listing.contactPhone.replace(/[^\d+]/g, '')}`
    : listing.contactEmail ? `mailto:${listing.contactEmail}?subject=${encodeURIComponent(title)}`
      : listingUrl;

  // ---------------------------------------------------------------- layout

  const stage = h('div.tv-stage');
  const root = h(`div.tv${embed ? '.embed' : ''}`, { dataset: { open: 'false' } },
    stage, h('div.tv-grad-top'), h('div.tv-grad-bottom'));
  app.append(root);

  const roomOf = (scan) => space.rooms.find((r) => pointInPolygon([scan.position.x, scan.position.z], r.points)) ?? null;
  const nameOf = (scan) => roomOf(scan)?.name ?? scan.name;
  const iconFor = (scan) => (/bath|baie|wc|toalet/i.test(nameOf(scan)) ? 'bath.svg' : 'door.svg');

  const viewer = new Viewer(stage, {
    panoUrl: pano,
    onScanChange: () => updateCurrent(),
    onModeChange: (mode) => {
      root.dataset.mode = mode;
      for (const b of modeChips.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === mode);
      cubeBtn.setAttribute('aria-pressed', mode === 'dollhouse');
      updateCurrent();
    },
    onMeasure: () => { sfx.ding(); showHint(); },
  });
  stage.viewer = viewer; // handle for end-to-end tests and debugging
  viewer.setHotspots(true, (scan) => h('span.hotspot-label', img(iconFor(scan), 'hs-icon', 16), h('span', nameOf(scan)), img('chevron-right.svg', 'hs-chev', 14)));

  // brand (top left)
  root.append(h('a.tv-brand', { href: brand.site, target: '_blank', rel: 'noopener', 'aria-label': brand.name },
    h('img', { src: '/brand/verificasa-mark.svg', alt: '', draggable: false }), wordmark()));

  // avatar with the capturer's plan badge
  const avatar = (cls) => h(`span.tv-avatar.${cls}`,
    h('span.tv-initials', initials(captor.name)),
    captor.plan ? img(PLAN_BADGE[captor.plan], 'tv-badge') : img('plan-free.svg', 'tv-badge'));

  // closed: a tab on the right edge
  const toggle = h('button.tv-toggle', {
    'aria-label': t('Show details'), 'aria-expanded': 'false', onclick: () => { unlock(); sfx.tap(); setOpen(true); },
  }, img('chevron-left.svg', 'tv-chev', 16), h('span.tv-toggle-text', t('Details')), avatar('sm'));

  // open: the details panel
  const heartBtn = action('heart.svg', t('Save'), () => toggleSaved());
  const linkBtn = action('link.svg', t('Copy link'), () => copyLink());
  const shareBtn = action('share.svg', t('Share'), () => share());
  const fullBtn = action('area.svg', t('Full screen'), () => fullscreen());
  const cubeBtn = action('cube.svg', t('Dollhouse'), () => viewer.setMode(viewer.mode === 'dollhouse' ? 'inside' : 'dollhouse'));
  const place = [listing.address ? null : [vc?.zone, vc?.city].filter(Boolean).join(', ') || null];
  const facts = [
    ...place,
    listing.beds != null ? countLabel(listing.beds, 'bed') : vc?.rooms != null ? roomsLabel(vc.rooms) : null,
    space.stats.totalArea > 0 ? formatArea(space.stats.totalArea).m2 : vc?.surface ? `${vc.surface} m²` : null,
    vc?.views ? `${vc.views.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB')} ${t('views')}` : null,
  ].filter(Boolean);
  const onSite = space.onSite ?? null;
  const verifiedMark = onSite ? h('span.tv-verified', { title: t('Captured on site with the VerifiCasa app') }, img('verified.svg', 'tv-ver', 16)) : null;
  const closeBtn = h('button.tv-close', { 'aria-label': t('Hide details'), onclick: () => { sfx.tap(); setOpen(false); } },
    img('chevron-right.svg', 'tv-close-desk', 16), img('chevron-down.svg', 'tv-close-phone', 16));
  const mapBox = h('div.tv-map', { role: 'group', 'aria-label': t('Floor plan') });
  const mapCount = h('span.tv-map-count');
  const modeChips = h('div.tv-modes', { role: 'group', 'aria-label': t('View mode') },
    chip('inside', t('Inside'), () => viewer.setMode('inside')),
    chip('dollhouse', t('Dollhouse'), () => viewer.setMode('dollhouse')),
    chip('floorplan', t('Floor plan'), () => viewer.setMode('floorplan')),
    h('button.tv-chip.icon-only', { dataset: { tool: 'measure' }, title: t('Measure'), 'aria-label': t('Measure'), 'aria-pressed': 'false', onclick: () => toggleMeasure() }, icon('ruler')),
  );
  const roomChips = h('div.tv-room-chips');

  const panel = h('aside.tv-panel', { 'aria-label': t('Property details') },
    h('div.tv-head',
      h('div.tv-title',
        h('div.tv-title-row', h('h1', title), verifiedMark),
        facts.length ? h('p.tv-sub', facts.join(' · ')) : null),
      closeBtn),
    h('hr.tv-div.desk'),
    captor.name || contactHref ? h('div.tv-captor',
      avatar('md'),
      h('div.tv-captor-text',
        h('span.tv-cap.desk', t('Captured by')),
        h('strong', h('span.phone', `${t('Captured by')} `), captor.name ?? brand.name),
        h('span.tv-cap', [captor.role, captor.plan ? PLAN_NAME[captor.plan] : null].filter(Boolean).join(' · ') || brand.siteLabel)),
      contactHref ? h('a.tv-contact', { href: contactHref, target: contactHref.startsWith('http') ? '_blank' : null, rel: 'noopener' }, t('Contact')) : null,
    ) : null,
    onSite ? h('p.tv-scanned', img('calendar.svg', 'tv-cal', 14), scannedText(onSite)) : null,
    h('hr.tv-div.desk'),
    h('section.tv-plan.desk',
      h('div.tv-plan-head', h('span', t('Floor plan')), mapCount),
      mapBox),
    modeChips,
    roomChips,
    h('hr.tv-div.desk'),
    h('div.tv-actions', heartBtn, linkBtn, shareBtn, fullBtn, cubeBtn, h('span.tv-spacer'),
      listingUrl && !embed ? h('a.tv-listing', { href: listingUrl, target: '_blank', rel: 'noopener' }, t('Listing'), img('external.svg', 'tv-ext', 14)) : null),
  );

  // rooms strip (bottom left, desktop)
  const rooms = h('nav.tv-rooms', { 'aria-label': t('Rooms') });

  // bottom centre: hint + hosted by
  const hint = h('div.tv-hint', { role: 'status' });
  const report = h('a.tv-report', { href: listingUrl ?? `${brand.site}/contact`, target: '_blank', rel: 'noopener' }, img('flag.svg', 'tv-flag', 14), t('Report'));
  const bottom = h('div.tv-bottom', hint,
    h('div.tv-hosted', h('img', { src: '/brand/verificasa-mark.svg', alt: '', draggable: false }), h('span.tv-hosted-by', t('3D tour hosted by')), wordmark(), h('span.tv-sep'), report));

  root.append(toggle, panel, rooms, bottom);

  if (!space.scans.length) {
    root.append(h('div.tv-empty', h('h2', t('Nothing to tour yet')),
      h('p', t('This space has no 360° spots. Capture or upload some in the editor to build the tour.')),
      embed ? null : h('a.tv-contact', { href: `#/space/${id}` }, t('Open editor'))));
  }

  // loading card over a blurred first panorama
  const progressBar = h('div.tv-progress', h('div'));
  const progressText = h('p.tv-load-text');
  const loading = space.scans.length ? h('div.tv-loading', { role: 'progressbar', 'aria-label': t('Loading 3D tour') },
    h('div.tv-load-bg', { style: `background-image:url("${pano(space.scans[0])}")` }),
    h('div.tv-load-card',
      h('img.tv-load-mark', { src: '/brand/verificasa-mark.svg', alt: '', draggable: false }),
      h('p.tv-load-word', wordmark()),
      h('p.tv-load-title', title),
      progressBar, progressText,
      captor.name ? h('hr.tv-div') : null,
      captor.name ? h('div.tv-load-captor', avatar('sm'), h('div',
        h('strong', `${t('Captured by')} ${captor.name}`),
        h('span.tv-cap', [captor.role, captor.plan ? `${brand.name} ${PLAN_NAME[captor.plan]}` : null].filter(Boolean).join(' · ')))) : null),
    h('p.tv-tip', t('Tip: use the floor plan to jump between rooms'))) : null;
  if (loading) root.append(loading);

  // ---------------------------------------------------------------- behaviour

  viewer.setSpace(space);
  renderRooms();
  updateCurrent();
  showHint();
  watchLoading();
  window.addEventListener('keydown', onKey);
  const onFull = () => fullBtn.setAttribute('aria-pressed', Boolean(document.fullscreenElement));
  document.addEventListener('fullscreenchange', onFull);
  // the drag hint goes once someone has looked around
  stage.addEventListener('pointerdown', () => setTimeout(() => hint.classList.add('gone'), 1200), { once: true });
  setSaved(isSaved());

  function setOpen(open) {
    root.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) drawMap();
  }

  function onKey(e) {
    if (e.key === 'Escape' && root.dataset.open === 'true') setOpen(false);
  }

  function action(file, label, onclick) {
    return h('button.tv-action', { title: label, 'aria-label': label, 'aria-pressed': 'false', onclick: () => { unlock(); sfx.tap(); onclick(); } }, img(file, 'tv-act', 16));
  }

  function chip(mode, label, onclick) {
    return h('button.tv-chip', { dataset: { mode }, 'aria-pressed': String(mode === 'inside'), onclick: () => { unlock(); onclick(); } }, label);
  }

  function renderRooms() {
    rooms.replaceChildren(...space.scans.map((s) => h('button.tv-room', { dataset: { scan: s.id }, onclick: () => { unlock(); viewer.goToScan(s.id); } },
      h('img', { src: pano(s), alt: '', loading: 'lazy', draggable: false }), h('span', nameOf(s)))));
    roomChips.replaceChildren(...space.scans.map((s) => h('button.tv-room-chip', { dataset: { scan: s.id }, onclick: () => { unlock(); viewer.goToScan(s.id); } },
      h('img', { src: pano(s), alt: '', loading: 'lazy', draggable: false }), h('span', nameOf(s)))));
    rooms.hidden = space.scans.length < 2;
    roomChips.hidden = space.scans.length < 2;
  }

  function updateCurrent() {
    const cur = viewer.currentScanId;
    for (const el of root.querySelectorAll('[data-scan]')) el.setAttribute('aria-current', el.dataset.scan === cur && viewer.mode === 'inside' ? 'true' : 'false');
    const i = space.scans.findIndex((s) => s.id === cur);
    mapCount.textContent = i >= 0 && space.scans.length > 1 ? t('Room {n} of {total}', { n: i + 1, total: space.scans.length }) : '';
    if (root.dataset.open === 'true') drawMap();
  }

  /** The spots as a small map: a dashed walk between them, the current one in green with its view cone. */
  function drawMap() {
    const W = 268, H = 96, pad = 22;
    const pts = space.scans.map((s) => [s.position.x, s.position.z]);
    if (!pts.length) return mapBox.replaceChildren();
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const k = Math.min((W - 2 * pad) / Math.max(maxX - minX, 1e-6), (H - 2 * pad) / Math.max(maxZ - minZ, 1e-6), 40);
    const cx = (W - (maxX - minX) * k) / 2, cy = (H - (maxZ - minZ) * k) / 2;
    const P = ([x, z]) => [cx + (x - minX) * k, cy + (z - minZ) * k];
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); svg.append(n); return n; };
    if (pts.length > 1) el('polyline', { points: pts.map((p) => P(p).join(',')).join(' '), fill: 'none', stroke: '#a1a1a6', 'stroke-width': 1.5, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' });
    space.scans.forEach((s, i) => {
      const [x, y] = P(pts[i]);
      const current = s.id === viewer.currentScanId;
      if (current) {
        // view cone, opening the way the camera looks (yaw 0 = -z = up on the map)
        const a = -viewer.yaw, spread = 0.6, r = 26;
        const p1 = [x + Math.sin(a - spread) * -r, y - Math.cos(a - spread) * r];
        const p2 = [x + Math.sin(a + spread) * -r, y - Math.cos(a + spread) * r];
        el('path', { d: `M${x},${y} L${p1} A${r},${r} 0 0 1 ${p2} Z`, fill: 'rgba(46,158,99,0.22)' });
      }
      const dot = el('circle', { cx: x, cy: y, r: current ? 6 : 4.5, fill: current ? '#2e9e63' : '#0a0a0a', stroke: '#fff', 'stroke-width': current ? 2 : 0 });
      const label = el('text', { x, y: y < H / 2 ? y + 17 : y - 9, 'text-anchor': 'middle', class: current ? 'cur' : '' });
      label.textContent = nameOf(s);
      for (const n of [dot, label]) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', () => { unlock(); viewer.goToScan(s.id); });
      }
    });
    mapBox.replaceChildren(svg);
  }

  function showHint() {
    hint.classList.remove('gone');
    hint.textContent = viewer.tool === 'measure'
      ? (viewer.pendingMeasure ? t('Tap the second point.') : t('Tap two points on any surface to measure between them.'))
      : t('Drag to look around · Click a circle to walk');
  }

  function toggleMeasure() {
    const on = viewer.tool !== 'measure';
    viewer.setTool(on ? 'measure' : 'navigate');
    if (!on) viewer.clearMeasurements();
    modeChips.querySelector('[data-tool]').setAttribute('aria-pressed', String(on));
    showHint();
    if (on && matchMedia('(max-width: 640px)').matches) setOpen(false);
  }

  function savedKey() { return `vc-saved-${id}`; }
  function isSaved() { try { return localStorage.getItem(savedKey()) === '1'; } catch { return false; } }
  function setSaved(on) {
    heartBtn.setAttribute('aria-pressed', String(on));
    heartBtn.title = on ? t('Saved') : t('Save');
    heartBtn.setAttribute('aria-label', heartBtn.title);
  }
  function toggleSaved() {
    const on = !isSaved();
    try { on ? localStorage.setItem(savedKey(), '1') : localStorage.removeItem(savedKey()); } catch { /* private mode */ }
    setSaved(on);
    toast(on ? t('Saved on this device') : t('Removed from saved'));
  }

  function link() { return `${location.origin}/3D/${id}`; }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link());
      toast(t('Link copied'));
    } catch {
      prompt(t('Copy this link'), link());
    }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title, url: link() }); } catch { /* cancelled */ }
    } else copyLink();
  }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root.requestFullscreen?.().catch(() => {});
  }

  function watchLoading() {
    if (!loading) return;
    const started = performance.now();
    const tick = () => {
      if (!root.isConnected) return;
      const all = [...viewer.textures.values()];
      const ready = all.filter((x) => x.ready).length;
      const first = viewer.textures.get(pano(viewer.scanById(viewer.currentScanId) ?? space.scans[0]));
      const pct = Math.round((100 * ready) / Math.max(all.length, 1));
      progressBar.firstChild.style.width = `${Math.max(8, pct)}%`;
      progressText.textContent = t('Loading 3D tour · {pct}%', { pct });
      // show the tour once the first room is ready (and the card was seen)
      // (or after 20 s, so a missing panorama never leaves the card up)
      if ((first?.ready && performance.now() - started > 500) || performance.now() - started > 20000) {
        loading.classList.add('done');
        setTimeout(() => loading.remove(), 450);
        if (!embed || matchMedia('(min-width: 641px)').matches) viewer.playIntro();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return () => {
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFull);
    viewer.dispose();
  };
}

function wordmark() {
  return h('span.tv-word', 'Verifi', h('span', 'Casa'));
}

function initials(name) {
  if (!name) return 'VC';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'VC';
}

function roomsLabel(n) {
  return lang === 'ro' ? `${n} ${n === 1 ? 'cameră' : 'camere'}` : `${n} ${n === 1 ? 'room' : 'rooms'}`;
}

function scannedText(onSite) {
  const d = new Date(onSite.capturedAt);
  const date = d.toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const parts = [t('Scanned {date}', { date })];
  if (onSite.distance != null) parts.push(onSite.distance <= 150 ? t('at the listing address') : t('{m} m from the listing address', { m: Math.round(onSite.distance) }));
  return parts.join(' · ');
}

