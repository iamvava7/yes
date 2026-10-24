import { centroid, normalizePolygon, pointInPolygon, polygonArea } from '../../shared/geometry.js';
import { t } from './i18n.js';
import { panoUrl } from './api.js';
import { isMuted, onMuteChange, setMuted, sfx, unlock } from './sound.js';
import { h, icon } from './ui.js';
import { Viewer } from './viewer/Viewer.js';

const MODES = [
  ['inside', 'walk', t('Inside')],
  ['dollhouse', 'cube', t('Dollhouse')],
  ['floorplan', 'plan', t('Floor plan')],
];

const TOOLS = {
  navigate: ['hand', t('Navigate')],
  measure: ['ruler', t('Measure')],
  tag: ['tag', t('Add tag')],
  trace: ['trace', t('Trace room')],
};

const TOUR_PAN_MS = 6500; // time spent turning at each spot during the guided tour
const TOUR_PAN_DEG = 110;
const SQFT_PER_M2 = 10.7639;

/**
 * Wraps a Viewer with its on-screen controls. `tools` picks which tools show
 * and `actions` which extras (guided tour, snapshot, share, sound); editing
 * hooks (onTagCreate, onTagDelete, onRoomTraced) are optional, which is how
 * the read-only tour page reuses this.
 */
export function createViewerChrome(container, spaceId, {
  tools = ['measure'], actions = ['play', 'snapshot', 'share', 'sound'],
  onTagCreate, onTagDelete, onRoomTraced, onScanChange, spaceName = 'tour',
} = {}) {
  const stage = h('div.viewer-stage');
  const modeBar = h('div.mode-bar', { role: 'tablist', 'aria-label': t('View mode') });
  const toolBar = h('div.tool-bar', { role: 'toolbar', 'aria-label': t('Tools') });
  const actionBar = h('div.action-bar', { role: 'toolbar', 'aria-label': t('Tour actions') });
  const banner = h('div.banner', { hidden: true, role: 'status' });
  const strip = h('div.scan-strip', { 'aria-label': t('Spots') });
  const popover = h('div.popover', { hidden: true });
  const sign = h('div.room-sign', { 'aria-live': 'polite' }, h('span.room-sign-name'), h('span.room-sign-area'));
  const minimap = h('canvas.minimap', { 'aria-label': t('Floor plan map: tap to move there'), role: 'img' });
  container.append(h('div.viewer-wrap',
    stage, sign, minimap,
    h('div.viewer-dock', modeBar, toolBar, actionBar),
    banner, strip, popover,
  ));

  let space = null;
  let lastRoomId = null;
  let signTimer = null;
  const viewer = new Viewer(stage, {
    panoUrl: panoUrl(spaceId),
    onModeChange: (mode) => {
      for (const b of modeBar.children) b.setAttribute('aria-selected', b.dataset.mode === mode);
      minimap.hidden = mode !== 'inside' || !space?.rooms.length;
      updateBanner();
    },
    onScanChange: (id) => {
      for (const b of strip.children) b.classList.toggle('current', b.dataset.scan === id);
      showRoomSign(id);
      onScanChange?.(id);
    },
    onTraceProgress: () => updateBanner(),
    onTraceComplete: (room) => {
      setTool('navigate');
      sfx.ding();
      onRoomTraced?.(room);
    },
    onTagPlace: (position, e) => openTagForm(position, e),
    onTagOpen: (tag, el) => { sfx.tap(); openTag(tag, el); },
    onMeasure: () => { sfx.ding(); updateBanner(); },
  });
  stage.viewer = viewer; // handle for end-to-end tests and debugging

  for (const [mode, ic, label] of MODES) {
    modeBar.append(h('button.mode', {
      role: 'tab', dataset: { mode }, title: label, 'aria-selected': mode === 'inside',
      onclick: () => { unlock(); stopTour(); viewer.setMode(mode); },
    }, icon(ic), h('span', label)));
  }
  for (const tool of tools) {
    const [ic, label] = TOOLS[tool];
    // tapping an active tool again turns it off (back to navigating)
    toolBar.append(h('button.tool', { dataset: { tool }, title: label, 'aria-pressed': tool === 'navigate', onclick: () => { unlock(); setTool(viewer.tool === tool && tool !== 'navigate' ? 'navigate' : tool); } }, icon(ic), h('span', label)));
  }
  toolBar.hidden = !tools.length;

  // ---------------------------------------------------------------- actions

  const playBtn = h('button.action', { title: t('Play guided tour'), 'aria-label': t('Play guided tour'), 'aria-pressed': false, onclick: () => (touring ? stopTour() : playTour()) }, icon('play'), h('span', t('Tour')));
  const soundBtn = h('button.action', { onclick: () => { unlock(); setMuted(!isMuted()); if (!isMuted()) sfx.tap(); } });
  const renderSound = () => {
    soundBtn.replaceChildren(icon(isMuted() ? 'mute' : 'sound'), h('span', isMuted() ? t('Sound off') : t('Sound on')));
    soundBtn.title = isMuted() ? t('Turn sound on') : t('Turn sound off');
    soundBtn.setAttribute('aria-label', soundBtn.title);
    soundBtn.setAttribute('aria-pressed', !isMuted());
  };
  renderSound();
  const offMute = onMuteChange(renderSound);
  const available = {
    play: playBtn,
    snapshot: h('button.action', { title: t('Save this view as a photo'), 'aria-label': t('Save this view as a photo'), onclick: snapshot }, icon('camera'), h('span', t('Snapshot'))),
    share: h('button.action', { title: t('Share or embed this tour'), 'aria-label': t('Share or embed this tour'), onclick: openShare }, icon('share'), h('span', t('Share'))),
    sound: soundBtn,
  };
  for (const a of actions) actionBar.append(available[a]);
  actionBar.hidden = !actions.length;

  function snapshot() {
    unlock();
    sfx.shutter();
    stage.classList.remove('flash');
    void stage.offsetWidth;
    stage.classList.add('flash');
    const a = h('a', { href: viewer.screenshot(), download: `${spaceName.replace(/[^\w-]+/g, '-').toLowerCase()}-snapshot.jpg` });
    document.body.append(a);
    a.click();
    a.remove();
  }

  function openShare(e) {
    unlock();
    sfx.tap();
    const link = `${location.origin}${location.pathname}#/view/${spaceId}`;
    // the short link shows the tour without the listing panel (the listing page has it)
    const short = `${location.origin}/3D/${spaceId}`;
    const embed = `<iframe src="${short}" width="100%" height="560" style="border:0" allow="fullscreen; accelerometer; gyroscope; xr-spatial-tracking" loading="lazy"></iframe>`;
    const copyRow = (label, value) => {
      const field = h('input', { value, readOnly: true, 'aria-label': label, onfocus: (ev) => ev.target.select() });
      const btn = h('button.secondary.small', {
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(value);
            btn.textContent = t('Copied');
          } catch {
            field.focus();
            field.select();
            btn.textContent = t('Press ⌘C');
          }
          setTimeout(() => { btn.textContent = t('Copy'); }, 1800);
        },
      }, t('Copy'));
      return h('label.field', h('span', label), h('div.input-row', field, btn));
    };
    popover.replaceChildren(h('div.share',
      h('div.row.spread', h('strong', t('Share this tour')), h('button.icon-btn', { title: t('Close'), onclick: closePopover }, icon('x'))),
      copyRow(t('Link'), link),
      copyRow(t('Link for a VerifiCasa listing (Link Tur 3D)'), short),
      copyRow(t('Embed on a website'), embed),
      navigator.share ? h('button.primary.small', { onclick: () => navigator.share({ title: spaceName, url: link }).catch(() => {}) }, t('Share…')) : null,
    ));
    const r = e.currentTarget.getBoundingClientRect();
    placePopover(r.left + r.width / 2, r.top - 8, 'above');
  }

  // ---------------------------------------------------------------- guided tour

  let touring = false;
  let tourToken = 0;
  async function playTour() {
    if (!space?.scans.length) return;
    unlock();
    touring = true;
    const token = ++tourToken;
    playBtn.setAttribute('aria-pressed', true);
    playBtn.title = t('Pause guided tour');
    playBtn.setAttribute('aria-label', playBtn.title);
    playBtn.replaceChildren(icon('pause'), h('span', t('Pause')));
    setTool('navigate');
    if (viewer.mode !== 'inside') {
      viewer.setMode('inside');
      await viewer.settled();
    }
    let i = Math.max(0, space.scans.findIndex((s) => s.id === viewer.currentScanId));
    while (touring && token === tourToken) {
      const scan = space.scans[i];
      if (scan.id !== viewer.currentScanId) {
        await viewer.goToScan(scan.id);
        await viewer.settled();
      }
      // slow look around the room
      const start = performance.now(), yaw0 = viewer.yaw;
      await new Promise((resolve) => {
        const step = (now) => {
          if (!touring || token !== tourToken) return resolve();
          const p = Math.min(1, (now - start) / TOUR_PAN_MS);
          const k = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          viewer.setLook(yaw0 + (k * TOUR_PAN_DEG * Math.PI) / 180, -0.08);
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      i = (i + 1) % space.scans.length;
    }
  }
  function stopTour() {
    if (!touring) return;
    touring = false;
    tourToken++;
    playBtn.setAttribute('aria-pressed', false);
    playBtn.title = t('Play guided tour');
    playBtn.setAttribute('aria-label', playBtn.title);
    playBtn.replaceChildren(icon('play'), h('span', t('Tour')));
  }
  // any direct interaction with the view takes over from the guided tour
  stage.addEventListener('pointerdown', stopTour);
  stage.addEventListener('wheel', stopTour, { passive: true });

  // ---------------------------------------------------------------- room sign

  function roomAt(scan) {
    return scan && space?.rooms.find((r) => pointInPolygon([scan.position.x, scan.position.z], r.points));
  }

  function showRoomSign(scanId) {
    const room = roomAt(space?.scans.find((s) => s.id === scanId));
    if (!room || room.id === lastRoomId) return;
    lastRoomId = room.id;
    const area = polygonArea(room.points);
    sign.querySelector('.room-sign-name').textContent = room.name;
    sign.querySelector('.room-sign-area').textContent = `${area.toFixed(1)} m² · ${Math.round(area * SQFT_PER_M2)} ft²`;
    sign.classList.remove('show');
    void sign.offsetWidth;
    sign.classList.add('show');
    clearTimeout(signTimer);
    signTimer = setTimeout(() => sign.classList.remove('show'), 3200);
  }

  // ---------------------------------------------------------------- minimap

  let mapRaf = 0;
  let mapFit = null;
  function fitMinimap() {
    const pts = [...space.rooms.flatMap((r) => r.points), ...space.scans.map((s) => [s.position.x, s.position.z])];
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }
  function mapTransform() {
    const w = minimap.clientWidth, hgt = minimap.clientHeight, pad = 12;
    const b = mapFit;
    const scale = Math.min((w - 2 * pad) / Math.max(b.maxX - b.minX, 1), (hgt - 2 * pad) / Math.max(b.maxZ - b.minZ, 1));
    const ox = (w - (b.maxX - b.minX) * scale) / 2 - b.minX * scale, oz = (hgt - (b.maxZ - b.minZ) * scale) / 2 - b.minZ * scale;
    return { scale, toPx: (x, z) => [ox + x * scale, oz + z * scale], toWorld: (px, py) => [(px - ox) / scale, (py - oz) / scale] };
  }
  function drawMinimap() {
    mapRaf = requestAnimationFrame(drawMinimap);
    if (minimap.hidden || !space || !mapFit) return;
    const dpr = window.devicePixelRatio || 1;
    const w = minimap.clientWidth, hgt = minimap.clientHeight;
    if (minimap.width !== Math.round(w * dpr)) { minimap.width = Math.round(w * dpr); minimap.height = Math.round(hgt * dpr); }
    const ctx = minimap.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const { scale, toPx } = mapTransform();
    const css = getComputedStyle(minimap);
    const room = css.getPropertyValue('--map-room').trim(), wall = css.getPropertyValue('--map-wall').trim(), brass = css.getPropertyValue('--map-cone').trim();
    for (const r of space.rooms) {
      ctx.beginPath();
      normalizePolygon(r.points).forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath();
      ctx.fillStyle = room;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = wall;
      ctx.stroke();
    }
    for (const s of space.scans) {
      const [px, py] = toPx(s.position.x, s.position.z);
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = wall;
      ctx.fill();
    }
    // you are here, with a cone showing where you're looking
    const cam = viewer.camera;
    const [px, py] = toPx(cam.position.x, cam.position.z);
    const hfov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
    const dir = Math.atan2(-Math.cos(viewer.yaw), -Math.sin(viewer.yaw)); // world (-sin yaw, -cos yaw) on screen (x, z)
    const len = Math.max(26, scale * 1.6);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, len);
    grad.addColorStop(0, brass);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, len, dir - hfov / 2, dir + hfov / 2);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = brass;
    ctx.stroke();
  }
  mapRaf = requestAnimationFrame(drawMinimap);
  minimap.addEventListener('click', (e) => {
    if (!mapFit) return;
    const r = minimap.getBoundingClientRect();
    const [x, z] = mapTransform().toWorld(e.clientX - r.left, e.clientY - r.top);
    const near = viewer.nearestScan({ x, z });
    if (near) { stopTour(); viewer.goToScan(near.scan.id); }
  });

  // ---------------------------------------------------------------- tools

  function setTool(tool) {
    if (tool === 'trace' && !viewer.currentScanId) return;
    if (tool !== 'navigate') stopTour();
    viewer.setTool(tool);
    for (const b of toolBar.children) b.setAttribute('aria-pressed', b.dataset.tool === tool);
    closePopover();
    updateBanner();
  }

  function updateBanner() {
    const tr = viewer.trace;
    banner.replaceChildren();
    let content = null;
    if (viewer.tool === 'trace' && tr) {
      if (tr.stage === 'floor') {
        content = [
          h('span', tr.points.length < 3
            ? t('Tap each corner where the walls meet the floor, going around the room ({n} so far).', { n: tr.points.length })
            : t('Keep adding corners, then tap the red first corner or press Enter to close the outline.')),
          h('button.secondary.small', { disabled: tr.points.length < 3, onclick: () => viewer.closeTrace() }, t('Close outline')),
          h('button.ghost.small', { onclick: () => setTool('navigate') }, t('Cancel')),
        ];
      } else {
        content = [
          h('span', t('Now tap where the ceiling meets the wall, directly above the red corner, to set the room height.')),
          h('button.secondary.small', { onclick: () => viewer.finishTrace(2.6) }, t('Use 2.6 m')),
          h('button.ghost.small', { onclick: () => setTool('navigate') }, t('Cancel')),
        ];
      }
    } else if (viewer.tool === 'measure') {
      content = [
        h('span', viewer.pendingMeasure ? t('Tap the second point.') : t('Tap two points on any surface to measure between them.')),
        viewer.measurements.length ? h('button.ghost.small', { onclick: () => { viewer.clearMeasurements(); updateBanner(); } }, t('Clear')) : null,
      ];
    } else if (viewer.tool === 'tag') {
      content = [h('span', t('Tap a surface to pin a note there.'))];
    }
    banner.hidden = !content;
    if (content) banner.append(...content.filter(Boolean));
  }
  // measurement taps don't emit a callback for the first point; keep text in sync
  stage.addEventListener('pointerup', () => queueMicrotask(updateBanner));

  // ---------------------------------------------------------------- popovers

  function placePopover(x, y, where = 'below') {
    const r = container.getBoundingClientRect();
    popover.hidden = false;
    const pw = popover.offsetWidth, ph = popover.offsetHeight;
    const top = where === 'above' ? y - r.top - ph : y - r.top + 14;
    popover.style.left = `${Math.min(Math.max(8, x - r.left - pw / 2), r.width - pw - 8)}px`;
    popover.style.top = `${Math.min(Math.max(8, top), r.height - ph - 8)}px`;
  }

  function closePopover() {
    popover.hidden = true;
    popover.replaceChildren();
  }

  function openTagForm(position, e) {
    const label = h('input', { type: 'text', placeholder: t('Label'), maxLength: 80, required: true, 'aria-label': t('Tag label') });
    const desc = h('textarea', { placeholder: t('Notes (optional)'), rows: 3, 'aria-label': t('Tag notes') });
    const form = h('form.tag-form', {
      onsubmit: async (ev) => {
        ev.preventDefault();
        if (!label.value.trim()) return;
        await onTagCreate?.({ label: label.value.trim(), description: desc.value, position });
        sfx.ding();
        closePopover();
      },
    }, label, desc, h('div.row', h('button.ghost.small', { type: 'button', onclick: closePopover }, t('Cancel')), h('button.primary.small', { type: 'submit' }, t('Save tag'))));
    popover.replaceChildren(form);
    placePopover(e.clientX, e.clientY);
    label.focus();
  }

  function openTag(tag, el) {
    const r = el.getBoundingClientRect();
    popover.replaceChildren(
      h('div.tag-view',
        h('div.row.spread', h('strong', tag.label), h('button.icon-btn', { title: t('Close'), onclick: closePopover }, icon('x'))),
        tag.description ? h('p', tag.description) : null,
        onTagDelete ? h('button.ghost.small.danger', { onclick: async () => { await onTagDelete(tag); closePopover(); } }, icon('trash'), t('Delete tag')) : null,
      ),
    );
    placePopover(r.left + r.width / 2, r.bottom);
  }

  function renderStrip() {
    strip.replaceChildren(...space.scans.map((s) => {
      const room = roomAt(s);
      return h('button.scan-thumb', {
        dataset: { scan: s.id },
        title: room ? `${s.name} · ${room.name}` : s.name,
        className: `scan-thumb${s.id === viewer.currentScanId ? ' current' : ''}`,
        onclick: () => { unlock(); stopTour(); viewer.goToScan(s.id); },
      }, h('img', { src: panoUrl(spaceId)(s), alt: '', loading: 'lazy', draggable: false }), h('span', room?.name ?? s.name));
    }));
    strip.hidden = space.scans.length < 2;
  }

  return {
    viewer,
    setTool,
    update(next) {
      space = next;
      mapFit = fitMinimap();
      viewer.setSpace(next);
      renderStrip();
      minimap.hidden = viewer.mode !== 'inside' || !next.rooms.length;
      for (const b of modeBar.children) b.disabled = b.dataset.mode === 'inside' && !next.scans.length;
      const trace = toolBar.querySelector('[data-tool="trace"]');
      if (trace) trace.disabled = !next.scans.length;
      playBtn.disabled = !next.scans.length;
    },
    preview(next) {
      space = next;
      mapFit = fitMinimap();
      viewer.setSpace(next);
    },
    dispose() {
      stopTour();
      cancelAnimationFrame(mapRaf);
      clearTimeout(signTimer);
      offMute();
      viewer.dispose();
    },
  };
}
